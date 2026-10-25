import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from database import engine, Base
import models  # Import all models so Base.metadata knows about them
from routers import (
    auth_router,
    users_router,
    books_router,
    chapters_router,
    tags_router,
    reviews_router,
    reading_router,
    ml_router,
)


from sqlalchemy import text


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Lifespan context manager that automatically initializes database tables
    from SQLAlchemy models on startup without requiring manual DDL execution.
    """
    try:
        Base.metadata.create_all(bind=engine)
        # Safe backward-compatible column addition for existing reading_progress table
        with engine.begin() as conn:
            if engine.dialect.name == "postgresql":
                conn.execute(text("ALTER TABLE reading_progress ADD COLUMN IF NOT EXISTS max_scroll_percentage FLOAT DEFAULT 0.0;"))
                conn.execute(text("ALTER TABLE reading_progress ADD COLUMN IF NOT EXISTS review_eligible BOOLEAN DEFAULT FALSE;"))
            elif engine.dialect.name == "sqlite":
                cols = [row[1] for row in conn.execute(text("PRAGMA table_info(reading_progress)")).fetchall()]
                if "max_scroll_percentage" not in cols:
                    conn.execute(text("ALTER TABLE reading_progress ADD COLUMN max_scroll_percentage FLOAT DEFAULT 0.0"))
                if "review_eligible" not in cols:
                    conn.execute(text("ALTER TABLE reading_progress ADD COLUMN review_eligible BOOLEAN DEFAULT 0"))
        print("Database tables initialized successfully.")
    except Exception as exc:
        print(f"Database connection note: Could not initialize tables automatically: {exc}")
        print("Please ensure your PostgreSQL service is running and DATABASE_URL in .env is correct.")
    yield


app = FastAPI(
    title="e-Library & Analytical Reading API",
    description=(
        "Full-stack Wattpad-like literary reading platform API. "
        "Provides authentication, book and chapter management, reader interactions, "
        "and reading analytics tracking."
    ),
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# CORS middleware for local frontend development and cloud deployment
origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:5174",
    "http://127.0.0.1:5174",
    "http://localhost:3000",
]

frontend_env = os.getenv("FRONTEND_URL")
if frontend_env:
    for url in frontend_env.split(","):
        cleaned = url.strip()
        if cleaned and cleaned not in origins:
            origins.append(cleaned)

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_origin_regex=r"^https:\/\/.*\.vercel\.app$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(auth_router)
app.include_router(users_router)
app.include_router(books_router)
app.include_router(chapters_router)
app.include_router(tags_router)
app.include_router(reviews_router)
app.include_router(reading_router)
app.include_router(ml_router)


@app.get("/", tags=["Health"])
def health_check():
    """Simple root health endpoint."""
    return {
        "status": "healthy",
        "service": "e-Library API",
        "docs": "/docs",
        "version": "1.0.0",
    }
