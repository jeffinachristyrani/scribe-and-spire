from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field, ConfigDict


# Bookmark schemas
class BookmarkBase(BaseModel):
    book_id: int
    chapter_id: int
    position: int = Field(default=0, ge=0)


class BookmarkCreate(BookmarkBase):
    pass


class BookmarkResponse(BookmarkBase):
    id: int
    user_id: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# Reading Progress schemas
class ReadingProgressBase(BaseModel):
    book_id: int
    chapter_id: int
    progress_percentage: float = Field(default=0.0, ge=0.0, le=100.0)
    max_scroll_percentage: float = Field(default=0.0, ge=0.0, le=100.0)
    review_eligible: bool = Field(default=False)


class ReadingProgressCreate(BaseModel):
    book_id: int
    chapter_id: int
    progress_percentage: float = Field(default=0.0, ge=0.0, le=100.0)


class ReadingScrollUpdate(BaseModel):
    book_id: int
    chapter_id: int
    scroll_percentage: float = Field(..., ge=0.0, le=100.0)


class ReviewEligibilityResponse(BaseModel):
    book_id: int
    eligible: bool
    max_scroll_percentage: float
    message: str


class ReadingProgressResponse(ReadingProgressBase):
    id: int
    user_id: int
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


# Reading History schemas
class ReadingHistoryCreate(BaseModel):
    book_id: int
    chapter_id: int


class ReadingHistoryResponse(BaseModel):
    id: int
    user_id: int
    book_id: int
    chapter_id: int
    started_at: datetime
    last_read_at: datetime

    model_config = ConfigDict(from_attributes=True)
