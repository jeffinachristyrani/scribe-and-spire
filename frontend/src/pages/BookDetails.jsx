import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import Loading from '../components/Loading';
import AuthorReviewAnalytics from '../components/AuthorReviewAnalytics';

const BookDetails = () => {
  const { id } = useParams();
  const { isAuthenticated, user } = useAuth();

  const [book, setBook] = useState(null);
  const [readingProgress, setReadingProgress] = useState(null);
  const [reviewEligible, setReviewEligible] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Review submission state
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewText, setReviewText] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);
  const [reviewFeedback, setReviewFeedback] = useState({ error: null, success: null });

  const fetchBookDetails = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get(`/books/${id}`);
      setBook(response.data);

      // If user is authenticated, fetch their reading progress and verified review eligibility
      if (localStorage.getItem('token')) {
        try {
          const progressRes = await api.get(`/reading/progress/${id}`);
          setReadingProgress(progressRes.data);
          if (progressRes.data?.review_eligible) {
            setReviewEligible(true);
          }
        } catch (e) {
          // Non-critical, ignore
        }

        try {
          const eligRes = await api.get(`/reading/eligibility/${id}`);
          setReviewEligible(Boolean(eligRes.data?.eligible));
        } catch (e) {
          // Fallback
        }
      }
    } catch (err) {
      console.error('Error fetching book details:', err);
      const detail = err.response?.data?.detail;
      setError(detail || 'Could not load book details from backend.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBookDetails();
  }, [id]);

  const handleReviewSubmit = async (e) => {
    e.preventDefault();
    setReviewFeedback({ error: null, success: null });

    if (!isAuthenticated) {
      setReviewFeedback({ error: 'Please sign in to submit a review.', success: null });
      return;
    }

    if (!reviewEligible) {
      setReviewFeedback({
        error: 'Reading engagement required: Please open and scroll through at least 20% of a chapter before reviewing.',
        success: null,
      });
      return;
    }

    try {
      setSubmittingReview(true);
      await api.post(`/books/${id}/reviews`, {
        rating: parseInt(reviewRating, 10),
        review_text: reviewText.trim() || null,
      });

      setReviewFeedback({ error: null, success: 'Thank you! Your review has been recorded.' });
      setReviewText('');
      // Refresh book details to show the new review
      fetchBookDetails();
    } catch (err) {
      console.error('Failed to post review:', err);
      const detail = err.response?.data?.detail;
      setReviewFeedback({
        error: detail || 'Failed to submit review. You may have already reviewed this title.',
        success: null,
      });
    } finally {
      setSubmittingReview(false);
    }
  };

  if (loading) {
    return <Loading message="Retrieving manuscript details..." />;
  }

  if (error || !book) {
    return (
      <div className="section-container" style={{ padding: '4rem 1.5rem' }}>
        <div className="alert-box alert-danger">
          <h3>Manuscript Not Found</h3>
          <p>{error || 'The requested book could not be found or is not currently published.'}</p>
          <Link to="/library" className="btn-primary" style={{ marginTop: '1rem', display: 'inline-block' }}>
            Back to Library
          </Link>
        </div>
      </div>
    );
  }

  const authorName = book.author?.display_name || book.author?.username || 'Unknown Author';
  const averageRating =
    book.reviews && book.reviews.length > 0
      ? (book.reviews.reduce((acc, r) => acc + r.rating, 0) / book.reviews.length).toFixed(1)
      : null;

  return (
    <div className="book-details-page">
      <div className="book-details-hero">
        <div className="section-container details-hero-container">
          {/* Cover Column */}
          <div className="details-cover-col">
            <div className="details-cover-wrapper">
              {book.cover_image ? (
                <img
                  src={book.cover_image}
                  alt={`Cover of ${book.title}`}
                  className="details-cover-img"
                  onError={(e) => {
                    e.target.style.display = 'none';
                    e.target.nextElementSibling.style.display = 'flex';
                  }}
                />
              ) : null}
              <div
                className="book-cover-placeholder details-cover-placeholder"
                style={{ display: book.cover_image ? 'none' : 'flex' }}
              >
                <div className="book-spine-accent"></div>
                <div className="book-cover-content">
                  <span className="book-cover-genre">{book.genre || 'Literature'}</span>
                  <h2 className="book-cover-title">{book.title}</h2>
                  <p className="book-cover-author">{authorName}</p>
                </div>
              </div>
            </div>

            {/* Reading Progress Indicator if reader was already engaged */}
            {readingProgress && (
              <div className="progress-badge-box">
                <span className="progress-label">Your Reading Progress:</span>
                <div className="progress-bar-track">
                  <div
                    className="progress-bar-fill"
                    style={{ width: `${readingProgress.progress_percentage}%` }}
                  ></div>
                </div>
                <span className="progress-pct">{readingProgress.progress_percentage}% Completed</span>
              </div>
            )}
          </div>

          {/* Metadata Column */}
          <div className="details-info-col">
            <div className="details-breadcrumbs">
              <Link to="/library">Library</Link> / <span>{book.genre || 'General'}</span>
            </div>

            <h1 className="details-title">{book.title}</h1>
            <p className="details-author">
              Written by <strong>{authorName}</strong>
            </p>

            <div className="details-stats-row">
              {averageRating ? (
                <div className="stat-item rating-stat">
                  <span className="star-icon">★</span>
                  <strong>{averageRating}</strong>
                  <span className="stat-sub">({book.reviews.length} {book.reviews.length === 1 ? 'review' : 'reviews'})</span>
                </div>
              ) : (
                <div className="stat-item">
                  <span className="stat-sub">No ratings yet</span>
                </div>
              )}

              <div className="stat-item">
                <span className="stat-icon">📄</span>
                <strong>{book.chapters?.length || 0}</strong>
                <span className="stat-sub">Chapters</span>
              </div>

              <div className="stat-item">
                <span className={`status-pill ${book.status}`}>
                  {book.status === 'published' ? 'Published' : 'Draft Work'}
                </span>
              </div>
            </div>

            <div className="details-description">
              <h3>Synopsis</h3>
              <p>{book.description || 'No synopsis provided by the author yet.'}</p>
            </div>

            {/* Tags */}
            {book.tags && book.tags.length > 0 && (
              <div className="details-tags">
                <span className="tags-label">Categorical Tags:</span>
                <div className="tags-container">
                  {book.tags.map((tag) => (
                    <Link key={tag.id} to={`/library?tag=${tag.name}`} className="tag-chip">
                      #{tag.name}
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* CTA and Author Actions */}
            <div className="details-cta-actions" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center' }}>
              {book.chapters && book.chapters.length > 0 && (
                <Link
                  to={`/books/${book.id}/read/${book.chapters[0].id}`}
                  className="btn-primary btn-large"
                >
                  Start Reading Chapter 1 →
                </Link>
              )}
              {isAuthenticated && (user?.id === book.author_id || user?.role === 'admin') && (
                <Link
                  to={`/author/books/${book.id}/edit`}
                  className="btn-outline btn-large"
                  title="Edit story synopsis, genre, cover, or generate AI tags"
                >
                  ✎ Edit Story Details
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="section-container details-content-grid">
        {/* Chapters Table */}
        <section className="chapters-section">
          <div className="section-header-row">
            <h2 className="section-heading">Table of Contents</h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <span className="section-meta">{book.chapters?.length || 0} Chapters Released</span>
              {isAuthenticated && (user?.id === book.author_id || user?.role === 'admin') && (
                <Link
                  to={`/author/books/${book.id}/chapters`}
                  className="btn-outline btn-small-action"
                >
                  ⚙ Manage Chapters
                </Link>
              )}
            </div>
          </div>

          {!book.chapters || book.chapters.length === 0 ? (
            <div className="empty-box">
              <p>No chapters have been released for this book yet.</p>
              {isAuthenticated && (user?.id === book.author_id || user?.role === 'admin') && (
                <Link
                  to={`/author/books/${book.id}/chapters/create`}
                  className="btn-primary"
                  style={{ marginTop: '0.75rem', display: 'inline-block' }}
                >
                  + Write First Chapter
                </Link>
              )}
            </div>
          ) : (
            <div className="chapters-list">
              {book.chapters.map((ch) => (
                <div key={ch.id} className="chapter-row">
                  <div className="chapter-meta">
                    <span className="chapter-number">Chapter {ch.chapter_number}</span>
                    <h4 className="chapter-title">{ch.title}</h4>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Link
                      to={`/books/${book.id}/read/${ch.id}`}
                      className="btn-outline btn-read"
                    >
                      Read Chapter →
                    </Link>
                    {isAuthenticated && (user?.id === book.author_id || user?.role === 'admin') && (
                      <Link
                        to={`/author/books/${book.id}/chapters/${ch.id}/edit`}
                        className="btn-outline btn-small-action btn-edit-chapter"
                        title="Edit chapter title, number, or content"
                      >
                        Edit
                      </Link>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ML Review Analytics & Sentiment Graphs (ONLY VISIBLE TO THIS BOOK'S AUTHOR) */}
        {isAuthenticated && (user?.id === book.author_id || user?.role === 'admin') && (
          <AuthorReviewAnalytics bookId={book.id} />
        )}

        {/* Reviews Section */}
        <section className="reviews-section">
          <div className="section-header-row">
            <h2 className="section-heading">Reader Reviews & Reflections</h2>
            <span className="section-meta">{book.reviews?.length || 0} total</span>
          </div>

          {/* Add Review Form */}
          <div className="review-form-card">
            <h3>Add Your Reflection</h3>
            {reviewFeedback.error && (
              <div className="alert-box alert-danger">{reviewFeedback.error}</div>
            )}
            {reviewFeedback.success && (
              <div className="alert-box alert-success">{reviewFeedback.success}</div>
            )}

            {isAuthenticated ? (
              <div>
                {!reviewEligible ? (
                  <div className="alert-box alert-warning" style={{ marginBottom: '1.25rem' }}>
                    <p style={{ margin: 0, fontWeight: 500 }}>
                      📖 <strong>Reading Engagement Required:</strong> Start reading and scroll through a little of the story (at least 20% of a chapter) to unlock reviews.
                    </p>
                    {book.chapters && book.chapters.length > 0 && (
                      <div style={{ marginTop: '0.65rem' }}>
                        <Link
                          to={`/books/${book.id}/read/${book.chapters[0].id}`}
                          className="btn-outline btn-small-action"
                        >
                          Open Chapter 1 to Start Reading →
                        </Link>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="alert-box alert-success" style={{ marginBottom: '1.25rem', fontSize: '0.88rem' }}>
                    ✓ <strong>Verified Reader:</strong> You have read and scrolled through chapter content. Review submission is unlocked!
                  </div>
                )}

                <form onSubmit={handleReviewSubmit}>
                  <div className="form-group">
                    <label htmlFor="review-rating">Rating (1 to 5 Stars)</label>
                    <select
                      id="review-rating"
                      value={reviewRating}
                      onChange={(e) => setReviewRating(e.target.value)}
                      disabled={!reviewEligible || submittingReview}
                      className="select-input"
                    >
                      <option value="5">★★★★★ 5 - Exceptional Work</option>
                      <option value="4">★★★★☆ 4 - Great Storytelling</option>
                      <option value="3">★★★☆☆ 3 - Good / Enjoyable</option>
                      <option value="2">★★☆☆☆ 2 - Fair / Needs Polish</option>
                      <option value="1">★☆☆☆☆ 1 - Poor</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label htmlFor="review-text">Review Content (Optional)</label>
                    <textarea
                      id="review-text"
                      rows="3"
                      value={reviewText}
                      onChange={(e) => setReviewText(e.target.value)}
                      disabled={!reviewEligible || submittingReview}
                      placeholder={reviewEligible ? "Share your thoughts on characters, prose, pacing, or worldbuilding..." : "Scroll through at least 20% of a chapter to unlock review writing..."}
                      className="textarea-input"
                    />
                  </div>

                  <button
                    type="submit"
                    className={`btn-primary ${!reviewEligible ? 'btn-disabled' : ''}`}
                    disabled={!reviewEligible || submittingReview}
                    title={reviewEligible ? 'Post your review' : 'Read at least 20% of a chapter to unlock'}
                  >
                    {submittingReview
                      ? 'Submitting...'
                      : !reviewEligible
                      ? 'Locked — Reading Required'
                      : 'Post Review'}
                  </button>
                </form>
              </div>
            ) : (
              <p className="signin-prompt">
                <Link to="/login" className="auth-link">Sign in</Link> to leave a review and rating for this work.
              </p>
            )}
          </div>

          {/* Reviews list */}
          <div className="reviews-stream">
            {!book.reviews || book.reviews.length === 0 ? (
              <div className="empty-box">
                <p>No reader reviews recorded yet. Be the first to share your thoughts!</p>
              </div>
            ) : (
              book.reviews.map((r) => (
                <div key={r.id} className="review-card">
                  <div className="review-header">
                    <div className="reviewer-info">
                      <span className="reviewer-avatar">
                        {r.user?.display_name?.charAt(0) || r.user?.username?.charAt(0) || 'R'}
                      </span>
                      <div>
                        <strong>{r.user?.display_name || r.user?.username || 'Reader'}</strong>
                        <span className="review-date">
                          {new Date(r.created_at).toLocaleDateString(undefined, {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                          })}
                        </span>
                      </div>
                    </div>
                    <div className="review-stars">
                      {'★'.repeat(r.rating)}
                      <span className="stars-empty">{'☆'.repeat(5 - r.rating)}</span>
                    </div>
                  </div>
                  {r.review_text && <p className="review-body">{r.review_text}</p>}
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
};

export default BookDetails;
