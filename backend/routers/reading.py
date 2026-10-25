from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from database import get_db
from models.user import User
from models.book import Book
from models.chapter import Chapter
from models.bookmark import Bookmark
from models.reading_progress import ReadingProgress
from models.reading_history import ReadingHistory
from schemas.reading import (
    BookmarkCreate,
    BookmarkResponse,
    ReadingProgressCreate,
    ReadingProgressResponse,
    ReadingScrollUpdate,
    ReviewEligibilityResponse,
    ReadingHistoryCreate,
    ReadingHistoryResponse,
)
from auth.dependencies import get_current_user

router = APIRouter(prefix="/reading", tags=["Reading & Activity"])


# --- BOOKMARKS ---

@router.get("/bookmarks", response_model=List[BookmarkResponse])
def get_user_bookmarks(
    book_id: Optional[int] = Query(None, description="Optional filter by book ID"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Retrieve reading bookmarks saved by the current user."""
    query = db.query(Bookmark).filter(Bookmark.user_id == current_user.id)
    if book_id:
        query = query.filter(Bookmark.book_id == book_id)
    return query.order_by(Bookmark.created_at.desc()).all()


@router.post("/bookmarks", response_model=BookmarkResponse, status_code=status.HTTP_201_CREATED)
def create_or_update_bookmark(
    bookmark_in: BookmarkCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Save or update a bookmark location in a chapter."""
    chapter = db.query(Chapter).filter(Chapter.id == bookmark_in.chapter_id).first()
    if not chapter:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chapter not found")

    # Check if a bookmark already exists for this book & user
    existing = (
        db.query(Bookmark)
        .filter(Bookmark.user_id == current_user.id, Bookmark.book_id == bookmark_in.book_id)
        .first()
    )

    if existing:
        existing.chapter_id = bookmark_in.chapter_id
        existing.position = bookmark_in.position
        db.commit()
        db.refresh(existing)
        return existing

    new_bookmark = Bookmark(
        user_id=current_user.id,
        book_id=bookmark_in.book_id,
        chapter_id=bookmark_in.chapter_id,
        position=bookmark_in.position,
    )
    db.add(new_bookmark)
    db.commit()
    db.refresh(new_bookmark)
    return new_bookmark


@router.delete("/bookmarks/{bookmark_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_bookmark(
    bookmark_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Remove a saved bookmark."""
    bookmark = db.query(Bookmark).filter(Bookmark.id == bookmark_id).first()
    if not bookmark:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Bookmark not found")

    if bookmark.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cannot delete another user's bookmark")

    db.delete(bookmark)
    db.commit()
    return None


# --- READING PROGRESS ---

@router.get("/progress/{book_id}", response_model=Optional[ReadingProgressResponse])
def get_reading_progress(
    book_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get current user's reading progress percentage for a book."""
    progress = (
        db.query(ReadingProgress)
        .filter(ReadingProgress.user_id == current_user.id, ReadingProgress.book_id == book_id)
        .first()
    )
    return progress


@router.post("/progress", response_model=ReadingProgressResponse)
def update_reading_progress(
    progress_in: ReadingProgressCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update reading progress percentage for a book and chapter."""
    chapter = db.query(Chapter).filter(Chapter.id == progress_in.chapter_id).first()
    if not chapter:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chapter not found")

    progress = (
        db.query(ReadingProgress)
        .filter(ReadingProgress.user_id == current_user.id, ReadingProgress.book_id == progress_in.book_id)
        .first()
    )

    if progress:
        progress.chapter_id = progress_in.chapter_id
        progress.progress_percentage = progress_in.progress_percentage
        progress.updated_at = datetime.now(timezone.utc)
    else:
        progress = ReadingProgress(
            user_id=current_user.id,
            book_id=progress_in.book_id,
            chapter_id=progress_in.chapter_id,
            progress_percentage=progress_in.progress_percentage,
            max_scroll_percentage=0.0,
            review_eligible=False,
        )
        db.add(progress)

    db.commit()
    db.refresh(progress)
    return progress


@router.post("/scroll-progress", response_model=ReadingProgressResponse)
def update_scroll_progress(
    scroll_in: ReadingScrollUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Track verified reader vertical scroll progress in a chapter.
    Enforces server-side validation and rate limiting to prevent trivial review gating bypasses.
    """
    chapter = db.query(Chapter).filter(Chapter.id == scroll_in.chapter_id).first()
    if not chapter:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chapter not found")
    if chapter.book_id != scroll_in.book_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Chapter does not belong to specified book")

    # Verify reader has actually opened/started this chapter via ReadingHistory
    history = (
        db.query(ReadingHistory)
        .filter(
            ReadingHistory.user_id == current_user.id,
            ReadingHistory.book_id == scroll_in.book_id,
            ReadingHistory.chapter_id == scroll_in.chapter_id,
        )
        .first()
    )
    if not history:
        # Chapter was never opened by this reader
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot record scroll progress without opening the chapter first."
        )

    # Server-side rate limit & timing sanity check:
    # Ensure at least 2 seconds elapsed since opening before claiming substantial scroll progress
    now = datetime.now(timezone.utc)
    started = history.started_at
    if started:
        if started.tzinfo is None:
            started = started.replace(tzinfo=timezone.utc)
        elapsed = (now - started).total_seconds()
        if scroll_in.scroll_percentage >= 20.0 and elapsed < 1.5:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Reading progress event too fast. Please read at a natural pace."
            )

    valid_scroll = min(100.0, max(0.0, float(scroll_in.scroll_percentage)))

    progress = (
        db.query(ReadingProgress)
        .filter(ReadingProgress.user_id == current_user.id, ReadingProgress.book_id == scroll_in.book_id)
        .first()
    )

    if progress:
        current_max = getattr(progress, "max_scroll_percentage", 0.0) or 0.0
        progress.chapter_id = scroll_in.chapter_id
        progress.max_scroll_percentage = max(current_max, valid_scroll)
        if progress.max_scroll_percentage >= 20.0:
            progress.review_eligible = True
        progress.updated_at = now
    else:
        is_eligible = valid_scroll >= 20.0
        progress = ReadingProgress(
            user_id=current_user.id,
            book_id=scroll_in.book_id,
            chapter_id=scroll_in.chapter_id,
            progress_percentage=0.0,
            max_scroll_percentage=valid_scroll,
            review_eligible=is_eligible,
        )
        db.add(progress)

    db.commit()
    db.refresh(progress)
    return progress


@router.get("/eligibility/{book_id}", response_model=ReviewEligibilityResponse)
def check_review_eligibility(
    book_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Check if current user is verified eligible to submit a review for this book.
    Requires at least 20% scroll through chapter content.
    """
    progress = (
        db.query(ReadingProgress)
        .filter(ReadingProgress.user_id == current_user.id, ReadingProgress.book_id == book_id)
        .first()
    )
    max_scroll = getattr(progress, "max_scroll_percentage", 0.0) if progress else 0.0
    eligible = bool(progress and getattr(progress, "review_eligible", False) and max_scroll >= 20.0)

    if eligible:
        message = f"Verified reader! Review submission unlocked ({round(max_scroll, 1)}% scrolled)."
    else:
        message = "Start reading and scroll through at least 20% of a chapter to unlock reviews."

    return ReviewEligibilityResponse(
        book_id=book_id,
        eligible=eligible,
        max_scroll_percentage=round(max_scroll, 1),
        message=message,
    )


# --- READING HISTORY ---

@router.get("/history", response_model=List[ReadingHistoryResponse])
def get_reading_history(
    limit: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List recent reading history for the current user."""
    history = (
        db.query(ReadingHistory)
        .filter(ReadingHistory.user_id == current_user.id)
        .order_by(ReadingHistory.last_read_at.desc())
        .limit(limit)
        .all()
    )
    return history


@router.post("/history", response_model=ReadingHistoryResponse)
def record_reading_session(
    history_in: ReadingHistoryCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Record or update a reading history entry when a reader opens/reads a chapter."""
    entry = (
        db.query(ReadingHistory)
        .filter(
            ReadingHistory.user_id == current_user.id,
            ReadingHistory.book_id == history_in.book_id,
            ReadingHistory.chapter_id == history_in.chapter_id,
        )
        .first()
    )

    now = datetime.now(timezone.utc)
    if entry:
        entry.last_read_at = now
    else:
        entry = ReadingHistory(
            user_id=current_user.id,
            book_id=history_in.book_id,
            chapter_id=history_in.chapter_id,
            started_at=now,
            last_read_at=now,
        )
        db.add(entry)

    db.commit()
    db.refresh(entry)
    return entry
