from __future__ import annotations

from datetime import datetime
from typing import Optional, List

from pydantic import BaseModel, HttpUrl


class PostOut(BaseModel):
	id: int | None = None
	image_url: HttpUrl | str
	caption: Optional[str]
	likes: int
	comments: int
	posted_at: Optional[datetime]
	keywords: Optional[list[str]]
	vibe: Optional[str]
	quality: Optional[str]

	class Config:
		from_attributes = True


class ReelOut(BaseModel):
	id: int | None = None
	thumbnail_url: HttpUrl | str
	caption: Optional[str]
	views: int
	likes: int
	comments: int
	posted_at: Optional[datetime]
	tags: Optional[list[str]]
	vibe: Optional[str]

	class Config:
		from_attributes = True


class InfluencerOut(BaseModel):
	id: int | None = None
	name: str
	username: str
	profile_picture_url: Optional[HttpUrl | str]
	followers: int
	following: int
	posts_count: int
	avg_likes: float
	avg_comments: float
	engagement_rate: float
	posts: List[PostOut]
	reels: List[ReelOut]

	class Config:
		from_attributes = True


