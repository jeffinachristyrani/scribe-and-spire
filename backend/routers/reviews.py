from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from database import get_db
from models.user import User
from models.book import Book
from models.review import Review
from models.reading_progress import ReadingProgress
from schemas.review import ReviewCreate, ReviewUpdate, ReviewResponse
from auth.dependencies import get_current_user

router = APIRouter(tags=["Reviews"])


@router.get("/books/{book_id}/reviews", response_model=List[ReviewResponse])
def get_book_reviews(book_id: int, db: Session = Depends(get_db)):
    """List all reader reviews and ratings for a book."""
    book = db.query(Book).filter(Book.id == book_id).first()
    if not book:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Book not found")

    reviews = (
        db.query(Review)
        .filter(Review.book_id == book_id)
        .order_by(Review.created_at.desc())
        .all()
    )
    return reviews


@router.post("/books/{book_id}/reviews", response_model=ReviewResponse, status_code=status.HTTP_201_CREATED)
def add_review(
    book_id: int,
    review_in: ReviewCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Add a review and rating (1-5) to a book."""
    book = db.query(Book).filter(Book.id == book_id).first()
    if not book:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Book not found")

    # Check if user already reviewed this book
    existing_review = (
        db.query(Review)
        .filter(Review.book_id == book_id, Review.user_id == current_user.id)
        .first()
    )
    if existing_review:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You have already reviewed this book. Use PUT /reviews/{id} to update it.",
        )

    # Server-side review eligibility enforcement: reader must have scrolled at least 20% of content
    progress = (
        db.query(ReadingProgress)
        .filter(ReadingProgress.book_id == book_id, ReadingProgress.user_id == current_user.id)
        .first()
    )
    max_scroll = getattr(progress, "max_scroll_percentage", 0.0) if progress else 0.0
    is_eligible = bool(progress and getattr(progress, "review_eligible", False) and max_scroll >= 20.0)

    if not is_eligible:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=(
                "Review submission requires verified reading engagement. "
                "Please open and scroll through at least 20% of a chapter before reviewing."
            ),
        )

    review = Review(
        user_id=current_user.id,
        book_id=book_id,
        rating=review_in.rating,
        review_text=review_in.review_text,
    )
    db.add(review)
    db.commit()
    db.refresh(review)
    return review


@router.put("/reviews/{review_id}", response_model=ReviewResponse)
def update_review(
    review_id: int,
    review_in: ReviewUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update a review. Readers can only edit their own reviews."""
    review = db.query(Review).filter(Review.id == review_id).first()
    if not review:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Review not found")

    if review.user_id != current_user.id and current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to edit another reader's review",
        )

    if review_in.rating is not None:
        review.rating = review_in.rating
    if review_in.review_text is not None:
        review.review_text = review_in.review_text

    db.commit()
    db.refresh(review)
    return review


@router.delete("/reviews/{review_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_review(
    review_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Delete a review. Readers can delete their own review; admins can moderate."""
    review = db.query(Review).filter(Review.id == review_id).first()
    if not review:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Review not found")

    if review.user_id != current_user.id and current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to delete another reader's review",
        )

    db.delete(review)
    db.commit()
    return None
