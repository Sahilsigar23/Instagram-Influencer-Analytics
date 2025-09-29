from sqlmodel import SQLModel, create_engine, Session

# Use synchronous SQLite (no async needed)
DATABASE_URL = "sqlite:///./backend/influencers.db"

engine = create_engine(DATABASE_URL, echo=False, connect_args={"check_same_thread": False})


def init_db():
    """Initialize database tables."""
    SQLModel.metadata.create_all(engine)


def get_session():
    """Dependency to get database session."""
    with Session(engine) as session:
        yield session
