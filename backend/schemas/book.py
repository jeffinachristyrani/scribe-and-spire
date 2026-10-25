from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, ConfigDict
from schemas.user import UserResponse
from schemas.tag import TagResponse
from schemas.chapter import ChapterListItem
from schemas.review import ReviewResponse


class BookBase(BaseModel):
    title: str
    description: Optional[str] = None
    cover_image: Optional[str] = None
    genre: Optional[str] = None


class BookCreate(BookBase):
    tag_ids: Optional[List[int]] = []


class BookUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    cover_image: Optional[str] = None
    genre: Optional[str] = None
    status: Optional[str] = None  # draft, published
    tag_ids: Optional[List[int]] = None


class BookResponse(BookBase):
    id: int
    author_id: int
    status: str
    created_at: datetime
    updated_at: datetime
    author: Optional[UserResponse] = None
    tags: List[TagResponse] = []

    model_config = ConfigDict(from_attributes=True)


class BookDetailResponse(BookResponse):
    chapters: List[ChapterListItem] = []
    reviews: List[ReviewResponse] = []

    model_config = ConfigDict(from_attributes=True)
