from __future__ import annotations

import io
import os
from typing import List
from dotenv import load_dotenv

import requests
from fastapi import FastAPI, Depends, HTTPException
import traceback
from fastapi.middleware.cors import CORSMiddleware
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

# Load environment variables
load_dotenv()

# Local imports (module run via `uvicorn main:app`)
from database import get_session, init_db  # type: ignore
from models import Influencer, Post, Reel  # type: ignore
from schemas import InfluencerOut, PostOut, ReelOut  # type: ignore
from analysis import (
    extract_keywords_from_image,
    classify_vibe_from_image,
    quality_indicators,
)  # type: ignore
from scraper import fetch_public_profile, fetch_instagram_posts_apify  # type: ignore

app = FastAPI(title="Influencer Analytics API")

# Get frontend URL from environment or use default
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")

# Configure CORS with environment-based origins
allowed_origins = [FRONTEND_URL]
# Also allow common local development URLs
if "localhost" in FRONTEND_URL or "127.0.0.1" in FRONTEND_URL:
	allowed_origins.extend([
		"http://localhost:5173",
		"http://127.0.0.1:5173",
		"http://localhost:5174",
	])

app.add_middleware(
	CORSMiddleware,
	allow_origins=allowed_origins,
	allow_credentials=True,
	allow_methods=["*"],
	allow_headers=["*"],
)


@app.on_event("startup")
async def on_startup() -> None:
	await init_db()
	# Pre-seed demo data
	from sqlmodel.ext.asyncio.session import AsyncSession
	session_gen = get_session()
	session: AsyncSession = await session_gen.__anext__()
	try:
		await seed_sample_data(session)
	finally:
		try:
			await session_gen.aclose()  # type: ignore[attr-defined]
		except Exception:
			pass


async def seed_sample_data(session: AsyncSession, username: str = "ralph") -> None:
    """Seed sample posts/reels for a username where missing."""
    inf = await ensure_influencer(session, username)
    placeholder_imgs = [
			"https://images.unsplash.com/photo-1460353581641-37baddab0fa2?w=800",
			"https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800",
			"https://images.unsplash.com/photo-1491553895911-0055eca6402d?w=800",
			"https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?w=800",
			"https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=800",
			"https://images.unsplash.com/photo-1520975922215-c0f03f0b2c70?w=800",
			"https://images.unsplash.com/photo-1487412947147-5cebf100ffc2?w=800",
			"https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800",
			"https://images.unsplash.com/photo-1520975594083-6c0b5eaa7b95?w=800",
			"https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=800",
        ]

    # Seed posts if none
    posts = (await session.execute(select(Post).where(Post.influencer_id == inf.id))).scalars().all()
    if not posts:
        for i, url in enumerate(placeholder_imgs[:10]):
            session.add(
                Post(
                    influencer_id=inf.id,
                    image_url=url,
                    caption=f"Sample post {i+1}",
                    likes=1000 + i * 123,
                    comments=50 + i * 7,
                )
            )

    # Seed reels if none
    reels = (await session.execute(select(Reel).where(Reel.influencer_id == inf.id))).scalars().all()
    if not reels:
        for i, url in enumerate(placeholder_imgs[:5]):
            session.add(
                Reel(
                    influencer_id=inf.id,
                    thumbnail_url=url,
                    caption=f"Sample reel {i+1}",
                    views=10000 + i * 2500,
                    likes=800 + i * 90,
                    comments=40 + i * 6,
                )
            )
    await session.commit()



@app.get("/health")
async def health() -> dict[str, str]:
	return {"status": "ok"}


@app.get("/proxy-image")
async def proxy_image(url: str):
	"""Proxy Instagram images to bypass CORS restrictions."""
	try:
		from fastapi.responses import Response
		response = requests.get(url, timeout=10, headers={
			"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
		})
		return Response(
			content=response.content,
			media_type=response.headers.get("content-type", "image/jpeg"),
			headers={
				"Cache-Control": "public, max-age=86400",  # Cache for 1 day
			}
		)
	except Exception as e:
		from fastapi.responses import JSONResponse
		return JSONResponse({"error": str(e)}, status_code=500)


async def ensure_influencer(session: AsyncSession, username: str) -> Influencer:
	result = await session.execute(select(Influencer).where(Influencer.username == username))
	inf = result.scalar_one_or_none()
	if inf:
		return inf
	# Seed minimal data from scraper fallback
	data = fetch_public_profile(username)
	if not data:
		inf = Influencer(name=username, username=username)
		session.add(inf)
		await session.commit()
		await session.refresh(inf)
		return inf
	# Simplified mapping from sample structure
	user = data.get("user", {})
	inf = Influencer(
		name=user.get("full_name", username),
		username=username,
		profile_picture_url=user.get("profile_pic_url"),
		followers=int(user.get("edge_followed_by", {}).get("count", 0)),
		following=int(user.get("edge_follow", {}).get("count", 0)),
		posts_count=int(user.get("edge_owner_to_timeline_media", {}).get("count", 0)),
	)
	session.add(inf)
	await session.commit()
	await session.refresh(inf)
	return inf


@app.get("/influencers/{username}", response_model=InfluencerOut)
async def get_influencer(username: str, session: AsyncSession = Depends(get_session)):
    try:
        inf = await ensure_influencer(session, username)
        await session.refresh(inf)
        # load posts and reels
        posts = (await session.execute(select(Post).where(Post.influencer_id == inf.id).limit(10))).scalars().all()
        reels = (await session.execute(select(Reel).where(Reel.influencer_id == inf.id).limit(5))).scalars().all()

        # compute averages and engagement
        if posts:
            avg_likes = sum(p.likes for p in posts) / len(posts)
            avg_comments = sum(p.comments for p in posts) / len(posts)
            inf.avg_likes = avg_likes
            inf.avg_comments = avg_comments
            if inf.followers:
                inf.engagement_rate = (avg_likes + avg_comments) / max(1, inf.followers) * 100.0
        await session.commit()
        await session.refresh(inf)

        # transform to schema lists
        def split_csv(val: str | None) -> list[str] | None:
            return [s for s in (val or "").split(",") if s] or None

        posts_out: List[PostOut] = [
            PostOut(
                id=p.id,
                image_url=p.image_url,
                caption=p.caption,
                likes=p.likes,
                comments=p.comments,
                posted_at=p.posted_at,
                keywords=split_csv(p.keywords),
                vibe=p.vibe,
                quality=p.quality,
            )
            for p in posts
        ]

        reels_out: List[ReelOut] = [
            ReelOut(
                id=r.id,
                thumbnail_url=r.thumbnail_url,
                caption=r.caption,
                views=r.views,
                likes=r.likes,
                comments=r.comments,
                posted_at=r.posted_at,
                tags=split_csv(r.tags),
                vibe=r.vibe,
            )
            for r in reels
        ]

        return InfluencerOut(
            id=inf.id,
            name=inf.name,
            username=inf.username,
            profile_picture_url=inf.profile_picture_url,
            followers=inf.followers,
            following=inf.following,
            posts_count=inf.posts_count,
            avg_likes=inf.avg_likes,
            avg_comments=inf.avg_comments,
            engagement_rate=inf.engagement_rate,
            posts=posts_out,
            reels=reels_out,
        )
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/analyze/post/{post_id}")
async def analyze_post(post_id: int, session: AsyncSession = Depends(get_session)):
	post = (await session.get(Post, post_id))
	if not post:
		raise HTTPException(status_code=404, detail="Post not found")
	# fetch image bytes
	resp = requests.get(post.image_url, timeout=10)
	image_bytes = resp.content
	post.keywords = ",".join(extract_keywords_from_image(image_bytes))
	post.vibe = classify_vibe_from_image(image_bytes)
	post.quality = quality_indicators(image_bytes)
	await session.commit()
	return {"id": post.id, "keywords": post.keywords, "vibe": post.vibe, "quality": post.quality}


@app.post("/seed/{username}")
async def seed_username(username: str, session: AsyncSession = Depends(get_session)):
    """Force seed posts and reels for a username if missing."""
    await seed_sample_data(session, username)
    return {"status": "seeded", "username": username}


@app.post("/fetch-apify/{username}")
async def fetch_from_apify(username: str, session: AsyncSession = Depends(get_session)):
    """
    Fetch fresh data from Apify for a username.
    This will scrape real Instagram data and store it in the database.
    """
    try:
        print(f"🔄 Fetching data from Apify for @{username}...")
        
        # Fetch profile data from Apify
        apify_data = fetch_public_profile(username)
        
        if not apify_data:
            raise HTTPException(status_code=404, detail="Could not fetch data from Apify. Please check your APIFY_API_TOKEN in backend/.env")
        
        # Extract profile information from Apify response
        # Apify Instagram Profile Scraper returns data in this structure
        profile = apify_data
        
        # Create or update influencer
        result = await session.execute(select(Influencer).where(Influencer.username == username))
        inf = result.scalar_one_or_none()
        
        if inf:
            # Update existing
            inf.name = profile.get("fullName", username)
            inf.profile_picture_url = profile.get("profilePicUrl", profile.get("profilePicture"))
            inf.followers = int(profile.get("followersCount", 0))
            inf.following = int(profile.get("followsCount", 0))
            inf.posts_count = int(profile.get("postsCount", 0))
        else:
            # Create new
            inf = Influencer(
                name=profile.get("fullName", username),
                username=username,
                profile_picture_url=profile.get("profilePicUrl", profile.get("profilePicture")),
                followers=int(profile.get("followersCount", 0)),
                following=int(profile.get("followsCount", 0)),
                posts_count=int(profile.get("postsCount", 0)),
            )
            session.add(inf)
        
        await session.commit()
        await session.refresh(inf)
        
        # Delete existing posts and reels for this influencer
        existing_posts = (await session.execute(select(Post).where(Post.influencer_id == inf.id))).scalars().all()
        for post in existing_posts:
            await session.delete(post)
        existing_reels = (await session.execute(select(Reel).where(Reel.influencer_id == inf.id))).scalars().all()
        for reel in existing_reels:
            await session.delete(reel)
        
        # Fetch and store posts from Apify
        apify_posts = fetch_instagram_posts_apify(username, limit=20)
        
        posts_added = 0
        reels_added = 0
        for post_data in apify_posts:
            # Some Apify post items may be videos (reels) or images. Detect common
            # fields and save as Reel when appropriate.
            is_video = False
            try:
                if isinstance(post_data, dict):
                    if post_data.get("isVideo"):
                        is_video = True
                    t = post_data.get("type") or post_data.get("mediaType")
                    if isinstance(t, str) and t.lower() == "video":
                        is_video = True
                    if post_data.get("videoUrl") or post_data.get("video_url"):
                        is_video = True
            except Exception:
                is_video = False

            if is_video:
                # Create Reel from video item
                reel = Reel(
                    influencer_id=inf.id,
                    thumbnail_url=post_data.get("thumbnailUrl", post_data.get("displayUrl", "")),
                    caption=post_data.get("caption", ""),
                    views=int(post_data.get("viewsCount", post_data.get("views", 0)) or 0),
                    likes=int(post_data.get("likesCount", post_data.get("likes", 0)) or 0),
                    comments=int(post_data.get("commentsCount", post_data.get("comments", 0)) or 0),
                    tags=",".join(post_data.get("tags", []) or []) if isinstance(post_data.get("tags"), list) else None,
                )
                session.add(reel)
                reels_added += 1
            else:
                # Regular image post
                post = Post(
                    influencer_id=inf.id,
                    image_url=post_data.get("displayUrl", post_data.get("url", "")),
                    caption=post_data.get("caption", ""),
                    likes=int(post_data.get("likesCount", 0)),
                    comments=int(post_data.get("commentsCount", 0)),
                )
                session.add(post)
                posts_added += 1
        
        # Also check if profile has latestPosts
        if "latestPosts" in profile:
            for post_data in profile.get("latestPosts", [])[:20]:
                post = Post(
                    influencer_id=inf.id,
                    image_url=post_data.get("displayUrl", ""),
                    caption=post_data.get("caption", ""),
                    likes=int(post_data.get("likesCount", 0)),
                    comments=int(post_data.get("commentsCount", 0)),
                )
                session.add(post)
                posts_added += 1

        # Try to extract reels from profile if present (actor variations exist)
        reels_source = profile.get("latestReels") or profile.get("latest_reels") or profile.get("latestReelsPosts") or profile.get("reels")
        if reels_source and isinstance(reels_source, list):
            for rdata in reels_source[:10]:
                # Robust mapping for common field names
                thumb = rdata.get("thumbnailUrl") or rdata.get("thumbnail_url") or rdata.get("displayUrl") or rdata.get("display_url") or rdata.get("imageUrl") or rdata.get("image_url")
                cap = rdata.get("caption") or rdata.get("description") or rdata.get("title") or ""
                views = int(rdata.get("playCount") or rdata.get("viewsCount") or rdata.get("views") or 0)
                likes = int(rdata.get("likesCount") or rdata.get("likes") or 0)
                comments = int(rdata.get("commentsCount") or rdata.get("comments") or 0)
                tags_val = rdata.get("tags") or rdata.get("keywords") or None
                tags_csv = ",".join(tags_val) if isinstance(tags_val, list) else (tags_val if isinstance(tags_val, str) else None)

                reel = Reel(
                    influencer_id=inf.id,
                    thumbnail_url=thumb or "",
                    caption=cap,
                    views=views,
                    likes=likes,
                    comments=comments,
                    tags=tags_csv,
                )
                session.add(reel)
                reels_added += 1
        
        await session.commit()
        
        return {
            "status": "success",
            "username": username,
            "message": f"Successfully fetched data from Apify. Added {posts_added} posts and {reels_added} reels.",
            "profile": {
                "followers": inf.followers,
                "following": inf.following,
                "posts_count": inf.posts_count,
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Error fetching from Apify: {str(e)}")


@app.get("/debug-apify/{username}")
async def debug_apify(username: str):
    """Return the raw Apify profile payload (or fallback sample) for inspection.
    Useful to see whether reels are present and under which keys.
    """
    try:
        data = fetch_public_profile(username)
        if not data:
            return {"status": "empty", "detail": "No data returned from Apify or fallback"}
        # Optionally trim very large payloads
        return {"status": "ok", "payload": data}
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/admin/clear-reels/{username}")
async def admin_clear_reels(username: str, session: AsyncSession = Depends(get_session)):
    """Delete all reels for the given influencer username (admin utility).
    Use this to remove previously-seeded sample reels.
    """
    try:
        result = await session.execute(select(Influencer).where(Influencer.username == username))
        inf = result.scalar_one_or_none()
        if not inf:
            raise HTTPException(status_code=404, detail="Influencer not found")
        reels = (await session.execute(select(Reel).where(Reel.influencer_id == inf.id))).scalars().all()
        for r in reels:
            await session.delete(r)
        await session.commit()
        return {"status": "ok", "deleted": len(reels)}
    except HTTPException:
        raise
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))
