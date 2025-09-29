from typing import AsyncIterator

from sqlmodel import SQLModel
from sqlmodel.ext.asyncio.session import AsyncSession
from sqlalchemy.ext.asyncio import create_async_engine, AsyncEngine
from sqlalchemy.orm import sessionmaker

DATABASE_URL = "sqlite+aiosqlite:///./influencers.db"

engine: AsyncEngine = create_async_engine(DATABASE_URL, echo=False, future=True)
AsyncSessionLocal = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


async def init_db() -> None:
	async with engine.begin() as conn:
		await conn.run_sync(SQLModel.metadata.create_all)


# FastAPI dependency that yields a session
async def get_session() -> AsyncIterator[AsyncSession]:
	session: AsyncSession = AsyncSessionLocal()
	try:
		yield session
	finally:
		await session.close()


