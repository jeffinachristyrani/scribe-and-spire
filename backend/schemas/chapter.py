from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict


class ChapterBase(BaseModel):
    title: str
    chapter_number: int
    content: str


class ChapterCreate(ChapterBase):
    pass


class ChapterUpdate(BaseModel):
    title: Optional[str] = None
    chapter_number: Optional[int] = None
    content: Optional[str] = None


class ChapterResponse(ChapterBase):
    id: int
    book_id: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ChapterListItem(BaseModel):
    id: int
    book_id: int
    title: str
    chapter_number: int
    created_at: datetime
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)
