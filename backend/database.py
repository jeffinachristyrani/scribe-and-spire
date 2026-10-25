import os
from typing import Generator
from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker, Session

# Load environment variables (.env.local overrides for local testing if present)
local_env = os.path.join(os.path.dirname(__file__), ".env.local")
if os.path.isfile(local_env):
    load_dotenv(local_env, override=True)
load_dotenv()

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql+psycopg://postgres:postgres@localhost:5432/elibrary"
)

# SQLite fallback support for local unit testing without active PostgreSQL server
connect_args = {}
if DATABASE_URL.startswith("sqlite"):
    connect_args["check_same_thread"] = False

engine = create_engine(
    DATABASE_URL,
    connect_args=connect_args,
    pool_pre_ping=True,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db() -> Generator[Session, None, None]:
    """Dependency for acquiring database sessions in FastAPI route handlers."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
