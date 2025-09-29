from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any, Dict, List
from apify_client import ApifyClient


def get_apify_token() -> str:
	"""Get Apify API token from environment variable."""
	return os.getenv("APIFY_API_TOKEN", "")


def fetch_instagram_profile_apify(username: str) -> Dict[str, Any]:
	"""
	Fetch Instagram profile data using Apify Instagram Profile Scraper.
	Returns profile data with posts and reels.
	"""
	token = get_apify_token()
	if not token:
		print("⚠️  APIFY_API_TOKEN not set, using fallback sample data")
		return {}
	
	try:
		client = ApifyClient(token)
		
		# Run the Instagram Profile Scraper actor
		# Actor ID: apify/instagram-profile-scraper
		# Ask the actor to include reels when available. Some actor versions
		# support the `scrapeReels` flag — enabling it increases the chance
		# that reel items are returned in the dataset.
		run_input = {
			"usernames": [username],
			"resultsLimit": 50,  # Get up to 50 posts
			"scrapeReels": True,
		}
		
		print(f"🔄 Fetching Instagram data for @{username} via Apify...")
		run = client.actor("apify/instagram-profile-scraper").call(run_input=run_input)
		
		# Fetch results from the actor's dataset
		results = []
		for item in client.dataset(run["defaultDatasetId"]).iterate_items():
			results.append(item)

		if results:
			print(f"✅ Successfully fetched {len(results)} items from Apify")

			# If debug is enabled, dump the full payload to stdout for inspection
			if os.getenv("APIFY_DEBUG"):
				try:
					print("--- APIFY PROFILE PAYLOAD DUMP START ---")
					print(json.dumps(results, indent=2, default=str))
					print("--- APIFY PROFILE PAYLOAD DUMP END ---")
				except Exception:
					pass

			# Try to pick the item that looks like the requested profile
			for item in results:
				# Some Apify actor outputs include a username or latestPosts/latestReels
				uname = None
				if isinstance(item, dict):
					uname = item.get("username") or (item.get("user") or {}).get("username")
					if uname and uname.lower() == username.lower():
						return item
					# If the item contains aggregated fields like latestPosts or latestReels, prefer it
					if "latestPosts" in item or "latestReels" in item or "latest_posts" in item:
						return item

			# Fallback to first item if no better match
			return results[0]
		
		print("⚠️  No results from Apify, using fallback")
		return {}
		
	except Exception as e:
		print(f"❌ Error fetching from Apify: {e}")
		return {}


def fetch_instagram_posts_apify(username: str, limit: int = 20) -> List[Dict[str, Any]]:
	"""
	Fetch Instagram posts using Apify Instagram Post Scraper.
	"""
	token = get_apify_token()
	if not token:
		return []
	
	try:
		client = ApifyClient(token)
		
		# Run the Instagram Post Scraper actor
		run_input = {
			"directUrls": [f"https://www.instagram.com/{username}/"],
			"resultsLimit": limit,
		}
		
		print(f"🔄 Fetching posts for @{username}...")
		run = client.actor("apify/instagram-post-scraper").call(run_input=run_input)
		
		posts = []
		for item in client.dataset(run["defaultDatasetId"]).iterate_items():
			posts.append(item)
		
		print(f"✅ Fetched {len(posts)} posts")
		return posts
		
	except Exception as e:
		print(f"❌ Error fetching posts: {e}")
		return []


def fetch_public_profile(username: str) -> Dict[str, Any]:
	"""
	Fetch Instagram profile data.
	Priority: 1) Apify API, 2) Direct scraping, 3) Sample data fallback
	"""
	# Try Apify first
	apify_data = fetch_instagram_profile_apify(username)
	if apify_data:
		return apify_data
	
	# Fallback to bundled sample
	print("⚠️  Using sample data fallback")
	sample_path = Path(__file__).with_name("sample_data.json")
	if sample_path.exists():
		return json.loads(sample_path.read_text(encoding="utf-8"))
	return {}
