from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from database import get_db
from models.user import User
from models.book import Book
from models.tag import Tag
from schemas.book import BookCreate, BookUpdate, BookResponse, BookDetailResponse
from auth.dependencies import (
    get_current_user,
    get_optional_current_user,
    require_author_or_admin,
)

router = APIRouter(prefix="/books", tags=["Books"])


@router.get("", response_model=List[BookResponse])
def list_books(
    genre: Optional[str] = Query(None, description="Filter by genre"),
    tag: Optional[str] = Query(None, description="Filter by tag name"),
    author_id: Optional[int] = Query(None, description="Filter by author ID"),
    search: Optional[str] = Query(None, description="Search in book title"),
    include_drafts: bool = Query(False, description="Include unpublished drafts for current author"),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    current_user: Optional[User] = Depends(get_optional_current_user),
    db: Session = Depends(get_db),
):
    """
    Browse books. By default, readers see all published books.
    Authors can optionally view their own drafts with include_drafts=true.
    """
    query = db.query(Book)

    # Visibility rules
    if include_drafts and current_user and current_user.role in ["author", "admin"]:
        if current_user.role == "author":
            # An author can see their own drafts plus other published books
            query = query.filter((Book.status == "published") | (Book.author_id == current_user.id))
    else:
        # Readers and unauthenticated users only see published books
        query = query.filter(Book.status == "published")

    # Filters
    if genre:
        query = query.filter(Book.genre.ilike(f"%{genre}%"))
    if search:
        query = query.filter(Book.title.ilike(f"%{search}%"))
    if author_id:
        query = query.filter(Book.author_id == author_id)
    if tag:
        query = query.join(Book.tags).filter(Tag.name.ilike(tag))

    books = query.order_by(Book.created_at.desc()).offset(skip).limit(limit).all()
    return books


@router.post("", response_model=BookResponse, status_code=status.HTTP_201_CREATED)
def create_book(
    book_in: BookCreate,
    current_user: User = Depends(require_author_or_admin),
    db: Session = Depends(get_db),
):
    """Create a new book. Only authors and admins can create books."""
    new_book = Book(
        title=book_in.title,
        description=book_in.description,
        cover_image=book_in.cover_image,
        genre=book_in.genre,
        author_id=current_user.id,
        status="draft",
    )

    if book_in.tag_ids:
        tags = db.query(Tag).filter(Tag.id.in_(book_in.tag_ids)).all()
        new_book.tags = tags

    db.add(new_book)
    db.commit()
    db.refresh(new_book)
    return new_book


@router.get("/{book_id}", response_model=BookDetailResponse)
def get_book(
    book_id: int,
    current_user: Optional[User] = Depends(get_optional_current_user),
    db: Session = Depends(get_db),
):
    """View full book details, including chapters, tags, and reviews."""
    book = db.query(Book).filter(Book.id == book_id).first()
    if not book:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Book not found")

    # If book is a draft, only the author or an admin can view it
    if book.status == "draft":
        if not current_user or (current_user.id != book.author_id and current_user.role != "admin"):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="This book is a draft and is only visible to its author",
            )

    return book


@router.put("/{book_id}", response_model=BookResponse)
def update_book(
    book_id: int,
    book_in: BookUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update book details. An author can ONLY edit their own books."""
    book = db.query(Book).filter(Book.id == book_id).first()
    if not book:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Book not found")

    # Check ownership
    if book.author_id != current_user.id and current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to edit another author's book",
        )

    if book_in.title is not None:
        book.title = book_in.title
    if book_in.description is not None:
        book.description = book_in.description
    if book_in.cover_image is not None:
        book.cover_image = book_in.cover_image
    if book_in.genre is not None:
        book.genre = book_in.genre
    if book_in.status is not None and book_in.status in ["draft", "published"]:
        book.status = book_in.status
    if book_in.tag_ids is not None:
        tags = db.query(Tag).filter(Tag.id.in_(book_in.tag_ids)).all()
        book.tags = tags

    db.commit()
    db.refresh(book)
    return book


@router.patch("/{book_id}/publish", response_model=BookResponse)
def toggle_publish_status(
    book_id: int,
    publish: bool = Query(True, description="True to publish, False to unpublish"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Publish or unpublish a book. Authors can only publish/unpublish their own books."""
    book = db.query(Book).filter(Book.id == book_id).first()
    if not book:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Book not found")

    if book.author_id != current_user.id and current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to publish or unpublish another author's book",
        )

    book.status = "published" if publish else "draft"
    db.commit()
    db.refresh(book)
    return book


@router.delete("/{book_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_book(
    book_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Delete a book and its associated chapters. Authors can only delete their own books."""
    book = db.query(Book).filter(Book.id == book_id).first()
    if not book:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Book not found")

    if book.author_id != current_user.id and current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to delete another author's book",
        )

    db.delete(book)
    db.commit()
    return None
