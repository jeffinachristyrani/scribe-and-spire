from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from database import get_db
from models.user import User
from models.book import Book
from models.chapter import Chapter
from schemas.chapter import ChapterCreate, ChapterUpdate, ChapterResponse, ChapterListItem
from auth.dependencies import get_current_user, get_optional_current_user

router = APIRouter(tags=["Chapters"])


@router.get("/books/{book_id}/chapters", response_model=List[ChapterListItem])
def list_book_chapters(
    book_id: int,
    current_user: Optional[User] = Depends(get_optional_current_user),
    db: Session = Depends(get_db),
):
    """List all chapters for a given book ordered by chapter number."""
    book = db.query(Book).filter(Book.id == book_id).first()
    if not book:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Book not found")

    if book.status == "draft":
        if not current_user or (current_user.id != book.author_id and current_user.role != "admin"):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="This book is unpublished and only visible to its author",
            )

    chapters = (
        db.query(Chapter)
        .filter(Chapter.book_id == book_id)
        .order_by(Chapter.chapter_number.asc())
        .all()
    )
    return chapters


@router.get("/chapters/{chapter_id}", response_model=ChapterResponse)
def get_chapter(
    chapter_id: int,
    current_user: Optional[User] = Depends(get_optional_current_user),
    db: Session = Depends(get_db),
):
    """Read a specific chapter with full text content."""
    chapter = db.query(Chapter).filter(Chapter.id == chapter_id).first()
    if not chapter:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chapter not found")

    book = chapter.book
    if book.status == "draft":
        if not current_user or (current_user.id != book.author_id and current_user.role != "admin"):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="This chapter belongs to a draft book and is only visible to its author",
            )

    return chapter


@router.post("/books/{book_id}/chapters", response_model=ChapterResponse, status_code=status.HTTP_201_CREATED)
def create_chapter(
    book_id: int,
    chapter_in: ChapterCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Create a new chapter for a book. Authors can only add chapters to their own books."""
    book = db.query(Book).filter(Book.id == book_id).first()
    if not book:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Book not found")

    if current_user.role not in ["author", "admin"] or (book.author_id != current_user.id and current_user.role != "admin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to add chapters to another author's book",
        )

    # Prevent duplicate chapter numbers within the same book
    existing_chapter = (
        db.query(Chapter)
        .filter(Chapter.book_id == book_id, Chapter.chapter_number == chapter_in.chapter_number)
        .first()
    )
    if existing_chapter:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Chapter number {chapter_in.chapter_number} already exists in this book",
        )

    new_chapter = Chapter(
        book_id=book_id,
        title=chapter_in.title,
        chapter_number=chapter_in.chapter_number,
        content=chapter_in.content,
    )
    db.add(new_chapter)
    db.commit()
    db.refresh(new_chapter)
    return new_chapter


@router.put("/chapters/{chapter_id}", response_model=ChapterResponse)
def update_chapter(
    chapter_id: int,
    chapter_in: ChapterUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update a chapter. Authors can only update chapters in their own books."""
    chapter = db.query(Chapter).filter(Chapter.id == chapter_id).first()
    if not chapter:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chapter not found")

    book = chapter.book
    if not book:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Book not found")

    if current_user.role not in ["author", "admin"] or (book.author_id != current_user.id and current_user.role != "admin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to edit chapters in another author's book",
        )

    if chapter_in.title is not None:
        chapter.title = chapter_in.title
    if chapter_in.content is not None:
        chapter.content = chapter_in.content
    if chapter_in.chapter_number is not None and chapter_in.chapter_number != chapter.chapter_number:
        # Check duplicate
        duplicate = (
            db.query(Chapter)
            .filter(
                Chapter.book_id == book.id,
                Chapter.chapter_number == chapter_in.chapter_number,
                Chapter.id != chapter.id,
            )
            .first()
        )
        if duplicate:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Chapter number {chapter_in.chapter_number} already exists in this book",
            )
        chapter.chapter_number = chapter_in.chapter_number

    db.commit()
    db.refresh(chapter)
    return chapter


@router.delete("/chapters/{chapter_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_chapter(
    chapter_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Delete a chapter. Authors can only delete chapters from their own books."""
    chapter = db.query(Chapter).filter(Chapter.id == chapter_id).first()
    if not chapter:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chapter not found")

    book = chapter.book
    if not book:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Book not found")

    if current_user.role not in ["author", "admin"] or (book.author_id != current_user.id and current_user.role != "admin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to delete chapters from another author's book",
        )

    db.delete(chapter)
    db.commit()
    return None
