from datetime import datetime
from typing import Optional, List

from sqlmodel import SQLModel, Field, Relationship


class Influencer(SQLModel, table=True):
	id: Optional[int] = Field(default=None, primary_key=True)
	name: str
	username: str
	profile_picture_url: Optional[str] = None
	followers: int = 0
	following: int = 0
	posts_count: int = 0
	avg_likes: float = 0.0
	avg_comments: float = 0.0
	engagement_rate: float = 0.0
	created_at: datetime = Field(default_factory=datetime.utcnow)

	posts: List["Post"] = Relationship(back_populates="influencer")
	reels: List["Reel"] = Relationship(back_populates="influencer")


class Post(SQLModel, table=True):
	id: Optional[int] = Field(default=None, primary_key=True)
	influencer_id: int = Field(foreign_key="influencer.id")
	image_url: str
	caption: Optional[str] = None
	likes: int = 0
	comments: int = 0
	posted_at: Optional[datetime] = None
	keywords: Optional[str] = None  # comma-separated
	vibe: Optional[str] = None
	quality: Optional[str] = None

	influencer: "Influencer" = Relationship(back_populates="posts")


class Reel(SQLModel, table=True):
	id: Optional[int] = Field(default=None, primary_key=True)
	influencer_id: int = Field(foreign_key="influencer.id")
	thumbnail_url: str
	caption: Optional[str] = None
	views: int = 0
	likes: int = 0
	comments: int = 0
	posted_at: Optional[datetime] = None
	tags: Optional[str] = None
	vibe: Optional[str] = None

	influencer: "Influencer" = Relationship(back_populates="reels")


