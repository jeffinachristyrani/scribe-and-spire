from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from database import get_db
from models.user import User
from models.book import Book
from models.tag import Tag
from schemas.tag import TagCreate, TagResponse
from auth.dependencies import get_current_user

router = APIRouter(tags=["Tags"])


@router.get("/tags", response_model=List[TagResponse])
def list_tags(db: Session = Depends(get_db)):
    """List all available literary tags and genres."""
    tags = db.query(Tag).order_by(Tag.name.asc()).all()
    return tags


@router.post("/tags", response_model=TagResponse, status_code=status.HTTP_201_CREATED)
def create_tag(
    tag_in: TagCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Create a new tag (e.g. 'Fantasy', 'Slow-burn', 'Cyberpunk')."""
    normalized_name = tag_in.name.strip().title()
    existing = db.query(Tag).filter(Tag.name.ilike(normalized_name)).first()
    if existing:
        return existing

    new_tag = Tag(name=normalized_name)
    db.add(new_tag)
    db.commit()
    db.refresh(new_tag)
    return new_tag


@router.post("/books/{book_id}/tags/{tag_id}", status_code=status.HTTP_200_OK)
def add_tag_to_book(
    book_id: int,
    tag_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Associate a tag with a book. Author only."""
    book = db.query(Book).filter(Book.id == book_id).first()
    if not book:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Book not found")

    if book.author_id != current_user.id and current_user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cannot edit another author's book")

    tag = db.query(Tag).filter(Tag.id == tag_id).first()
    if not tag:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tag not found")

    if tag not in book.tags:
        book.tags.append(tag)
        db.commit()

    return {"message": f"Tag '{tag.name}' added to '{book.title}'"}


@router.delete("/books/{book_id}/tags/{tag_id}", status_code=status.HTTP_200_OK)
def remove_tag_from_book(
    book_id: int,
    tag_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Remove a tag from a book. Author only."""
    book = db.query(Book).filter(Book.id == book_id).first()
    if not book:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Book not found")

    if book.author_id != current_user.id and current_user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cannot edit another author's book")

    tag = db.query(Tag).filter(Tag.id == tag_id).first()
    if not tag:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tag not found")

    if tag in book.tags:
        book.tags.remove(tag)
        db.commit()

    return {"message": f"Tag '{tag.name}' removed from '{book.title}'"}
