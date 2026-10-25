from typing import Optional
from pydantic import BaseModel, EmailStr
from schemas.user import UserResponse


class RegisterRequest(BaseModel):
    username: str
    email: EmailStr
    password: str
    display_name: Optional[str] = None
    role: Optional[str] = "reader"  # reader, author


class LoginRequest(BaseModel):
    username_or_email: str
    password: str


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


class TokenData(BaseModel):
    user_id: Optional[int] = None
