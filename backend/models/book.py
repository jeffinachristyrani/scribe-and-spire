from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from database import Base
from models.tag import book_tags


class Book(Base):
    __tablename__ = "books"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), index=True, nullable=False)
    description = Column(Text, nullable=True)
    cover_image = Column(String(500), nullable=True)
    author_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    genre = Column(String(100), index=True, nullable=True)
    status = Column(String(20), default="draft", nullable=False)  # draft, published
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    # Relationships
    author = relationship("User", back_populates="books")
    chapters = relationship(
        "Chapter",
        back_populates="book",
        cascade="all, delete-orphan",
        order_by="Chapter.chapter_number",
    )
    tags = relationship("Tag", secondary=book_tags, back_populates="books")
    reviews = relationship("Review", back_populates="book", cascade="all, delete-orphan")
    bookmarks = relationship("Bookmark", back_populates="book", cascade="all, delete-orphan")
    reading_progress = relationship("ReadingProgress", back_populates="book", cascade="all, delete-orphan")
    reading_history = relationship("ReadingHistory", back_populates="book", cascade="all, delete-orphan")
