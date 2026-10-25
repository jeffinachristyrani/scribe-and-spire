from routers.auth import router as auth_router
from routers.users import router as users_router
from routers.books import router as books_router
from routers.chapters import router as chapters_router
from routers.tags import router as tags_router
from routers.reviews import router as reviews_router
from routers.reading import router as reading_router
from routers.ml import router as ml_router

__all__ = [
    "auth_router",
    "users_router",
    "books_router",
    "chapters_router",
    "tags_router",
    "reviews_router",
    "reading_router",
    "ml_router",
]
