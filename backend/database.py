from sqlmodel import SQLModel, create_engine, Session

# Use synchronous SQLite (no async needed)
# On Render, root directory is "backend", so just use ./influencers.db
DATABASE_URL = "sqlite:///./influencers.db"

engine = create_engine(DATABASE_URL, echo=False, connect_args={"check_same_thread": False})


def init_db():
    """Initialize database tables."""
    SQLModel.metadata.create_all(engine)


def get_session():
    """Dependency to get database session."""
    with Session(engine) as session:
        yield session
