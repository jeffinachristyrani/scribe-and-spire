from datetime import datetime
from typing import Optional
from pydantic import BaseModel, EmailStr, ConfigDict


class UserBase(BaseModel):
    username: str
    email: EmailStr
    display_name: Optional[str] = None
    bio: Optional[str] = None


class UserCreate(UserBase):
    password: str
    role: Optional[str] = "reader"  # reader, author, admin


class UserUpdate(BaseModel):
    display_name: Optional[str] = None
    bio: Optional[str] = None
    email: Optional[EmailStr] = None


class UserResponse(UserBase):
    id: int
    role: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
