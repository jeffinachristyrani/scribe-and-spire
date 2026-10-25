import os
import sys
from typing import List, Dict, Any, Optional, Tuple
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from database import get_db
from models.user import User
from models.book import Book
from models.chapter import Chapter
from models.tag import Tag
from models.review import Review
from models.reading_progress import ReadingProgress
from models.reading_history import ReadingHistory
from models.bookmark import Bookmark
from auth.dependencies import get_current_user, get_optional_current_user

# Ensure e-library root directory is in sys.path to access ml modules
ml_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "../.."))
if ml_root not in sys.path:
    sys.path.insert(0, ml_root)

from ml.classification.tagger import suggest_tags_for_book
from ml.sentiment.analyzer import analyze_book_reviews
from ml.clustering.reader_clustering import cluster_readers
from ml.recommendation.recommender import get_user_recommendations

router = APIRouter(prefix="/ml", tags=["Machine Learning & Analytics"])


# ==============================================================================
# 1. NLP Content Tagging & Keyword Suggestion Endpoint
# ==============================================================================
@router.post("/books/{book_id}/suggest-tags")
def get_suggested_tags(
    book_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    NLP Book Content Analyzer:
    Analyzes title, synopsis, and serialized chapters to generate recommended
    thematic tags and literary keywords for the author to accept or modify.
    Strictly authorized to the book author or admin.
    """
    book = db.query(Book).filter(Book.id == book_id).first()
    if not book:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Book not found")

    if current_user.role not in ["author", "admin"] or (book.author_id != current_user.id and current_user.role != "admin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to generate tag suggestions for another author's book",
        )

    # Gather chapter prose content
    chapters_content = [ch.content for ch in book.chapters if ch.content]

    # Gather existing catalog tag names for vocabulary matching
    all_db_tags = [t.name for t in db.query(Tag).all()]

    result = suggest_tags_for_book(
        title=book.title,
        description=book.description or "",
        chapters_content=chapters_content,
        existing_tags=all_db_tags,
        max_suggestions=10
    )

    return result


# ==============================================================================
# 2. Review Sentiment Analysis & Graph Analytics (Author-Only)
# ==============================================================================
@router.get("/books/{book_id}/review-analytics")
def get_book_review_analytics(
    book_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Review Sentiment Analysis & Visualization Engine:
    Analyzes reader reviews, ratings distribution, text sentiment polarity,
    and discussion aspects.
    IMPORTANT SECURITY REQUIREMENT:
    Visible and accessible ONLY to the author of that book (or platform admin).
    """
    book = db.query(Book).filter(Book.id == book_id).first()
    if not book:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Book not found")

    # Enforce author-only authorization
    if book.author_id != current_user.id and current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Review analytics and reader feedback graphs are confidential and accessible only to this book's author.",
        )

    # Fetch all reviews for this book
    reviews = db.query(Review).filter(Review.book_id == book_id).all()
    
    reviews_payload = []
    for r in reviews:
        reviews_payload.append({
            "id": r.id,
            "rating": r.rating,
            "review_text": r.review_text,
            "created_at": r.created_at.isoformat() if r.created_at else None,
            "user_id": r.user_id,
            "username": r.user.username if r.user else "Anonymous Reader"
        })

    analytics = analyze_book_reviews(reviews_payload, book_id=book.id)
    analytics["book_title"] = book.title
    analytics["book_id"] = book.id

    return analytics


# ==============================================================================
# 3. Reader Clustering & KNN Personalized Recommendations / Top Picks
# ==============================================================================
def _compile_users_activity_dataset(db: Session) -> Tuple[List[Dict[str, Any]], Dict[int, Any]]:
    """Helper that extracts and aggregates reader interactions across the platform."""
    users = db.query(User).all()
    all_progress = db.query(ReadingProgress).all()
    all_bookmarks = db.query(Bookmark).all()
    all_reviews = db.query(Review).all()
    all_history = db.query(ReadingHistory).all()
    all_books = {b.id: b for b in db.query(Book).all()}

    # Index by user_id
    progress_by_user = {}
    for p in all_progress:
        progress_by_user.setdefault(p.user_id, []).append(p)

    bookmarks_by_user = {}
    for bm in all_bookmarks:
        bookmarks_by_user.setdefault(bm.user_id, []).append(bm)

    reviews_by_user = {}
    for r in all_reviews:
        reviews_by_user.setdefault(r.user_id, []).append(r)

    history_by_user = {}
    for h in all_history:
        history_by_user.setdefault(h.user_id, []).append(h)

    users_activity = []
    for u in users:
        u_prog = progress_by_user.get(u.id, [])
        u_bms = bookmarks_by_user.get(u.id, [])
        u_revs = reviews_by_user.get(u.id, [])
        u_hist = history_by_user.get(u.id, [])

        total_sessions = len(u_hist)
        bookmarks_count = len(u_bms)
        reviews_count = len(u_revs)
        
        avg_rating = (sum(r.rating for r in u_revs) / len(u_revs)) if u_revs else 3.0
        completed_books = sum(1 for p in u_prog if p.progress_percentage >= 90)
        avg_progress = (sum(p.progress_percentage for p in u_prog) / len(u_prog)) if u_prog else 0.0

        # Genre affinities
        genre_counts = {}
        for p in u_prog:
            bk = all_books.get(p.book_id)
            if bk and bk.genre:
                g_key = bk.genre.lower()
                genre_counts[g_key] = genre_counts.get(g_key, 0) + 1

        top_genre = max(genre_counts.items(), key=lambda x: x[1])[0] if genre_counts else None

        # Engaged books for collaborative filtering
        engaged_books = []
        user_ratings_map = {r.book_id: r.rating for r in u_revs}
        for p in u_prog:
            engaged_books.append({
                "book_id": p.book_id,
                "progress_percentage": p.progress_percentage,
                "rating": user_ratings_map.get(p.book_id, 4)
            })

        users_activity.append({
            "user_id": u.id,
            "username": u.username,
            "total_sessions": total_sessions,
            "bookmarks_count": bookmarks_count,
            "reviews_count": reviews_count,
            "avg_rating": avg_rating,
            "completed_books": completed_books,
            "avg_progress_pct": avg_progress,
            "genre_counts": genre_counts,
            "top_genre": top_genre,
            "engaged_books": engaged_books
        })

    return users_activity, all_books


@router.get("/recommendations")
def get_recommendations_for_user(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Reader Clustering & KNN Top Picks Recommender:
    1. Clusters all readers by reading habits via K-Means.
    2. Identifies nearest neighbor readers using K-Nearest Neighbors (KNN).
    3. Recommends books read by similar users and generates personalized Top Picks.
    """
    users_activity, all_books_map = _compile_users_activity_dataset(db)

    # Format all published books
    published_books = []
    for b in all_books_map.values():
        if b.status == "published":
            ratings = [r.rating for r in b.reviews]
            avg_r = round(sum(ratings) / len(ratings), 1) if ratings else 4.5
            author_name = b.author.display_name or b.author.username if b.author else "Author"
            
            published_books.append({
                "id": b.id,
                "title": b.title,
                "description": b.description,
                "genre": b.genre,
                "cover_image": b.cover_image,
                "author_id": b.author_id,
                "author_name": author_name,
                "average_rating": avg_r,
                "reviews_count": len(b.reviews),
                "chapters_count": len(b.chapters)
            })

    # Books current user has finished or heavily engaged with (to avoid re-recommending finished books)
    user_prog = db.query(ReadingProgress).filter(
        ReadingProgress.user_id == current_user.id,
        ReadingProgress.progress_percentage >= 85
    ).all()
    user_read_ids = [p.book_id for p in user_prog]

    recommendations = get_user_recommendations(
        target_user_id=current_user.id,
        users_activity=users_activity,
        all_published_books=published_books,
        user_read_book_ids=user_read_ids,
        max_recommendations=6
    )

    return recommendations
