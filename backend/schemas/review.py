from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field, ConfigDict
from schemas.user import UserResponse


class ReviewBase(BaseModel):
    rating: int = Field(..., ge=1, le=5, description="Rating from 1 to 5")
    review_text: Optional[str] = None


class ReviewCreate(ReviewBase):
    pass


class ReviewUpdate(BaseModel):
    rating: Optional[int] = Field(None, ge=1, le=5)
    review_text: Optional[str] = None


class ReviewResponse(ReviewBase):
    id: int
    user_id: int
    book_id: int
    created_at: datetime
    updated_at: datetime
    user: Optional[UserResponse] = None

    model_config = ConfigDict(from_attributes=True)
