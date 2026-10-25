from datetime import datetime, timezone
from sqlalchemy import Column, Integer, Float, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from database import Base


class ReadingProgress(Base):
    __tablename__ = "reading_progress"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    book_id = Column(Integer, ForeignKey("books.id", ondelete="CASCADE"), nullable=False)
    chapter_id = Column(Integer, ForeignKey("chapters.id", ondelete="CASCADE"), nullable=False)
    progress_percentage = Column(Float, default=0.0, nullable=False)  # 0.0 to 100.0 (chapter milestone)
    max_scroll_percentage = Column(Float, default=0.0, nullable=False)  # 0.0 to 100.0 (content scroll)
    review_eligible = Column(Boolean, default=False, nullable=False)  # Verified >= 20% read
    updated_at = Column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    # Relationships
    user = relationship("User", back_populates="reading_progress")
    book = relationship("Book", back_populates="reading_progress")
    chapter = relationship("Chapter")
