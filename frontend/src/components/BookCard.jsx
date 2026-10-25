import React from 'react';
import { Link } from 'react-router-dom';

const BookCard = ({ book }) => {
  const authorName =
    book.author?.display_name ||
    book.author?.username ||
    book.author_name ||
    'Unknown Author';

  return (
    <article className="book-card">
      <Link to={`/books/${book.id}`} className="book-card-link">
        <div className="book-cover-wrapper">
          {book.cover_image ? (
            <img
              src={book.cover_image}
              alt={`Cover of ${book.title}`}
              className="book-cover-img"
              loading="lazy"
              onError={(e) => {
                // Graceful fallback to typography cover if image link fails
                e.target.style.display = 'none';
                e.target.nextElementSibling.style.display = 'flex';
              }}
            />
          ) : null}

          {/* Elegant fallback literary book cover */}
          <div
            className="book-cover-placeholder"
            style={{ display: book.cover_image ? 'none' : 'flex' }}
          >
            <div className="book-spine-accent"></div>
            <div className="book-cover-content">
              <span className="book-cover-genre">{book.genre || 'Literature'}</span>
              <h3 className="book-cover-title">{book.title}</h3>
              <p className="book-cover-author">{authorName}</p>
            </div>
          </div>

          {book.match_score_pct ? (
            <div className="book-match-pill">
              <span>★ {book.match_score_pct}% Match</span>
            </div>
          ) : (
            <div className="book-status-pill">
              <span className={`status-dot ${book.status === 'published' ? 'published' : 'draft'}`}></span>
              {book.status === 'published' ? 'Published' : 'Draft'}
            </div>
          )}
        </div>

        <div className="book-card-info">
          {book.genre && <span className="genre-tag">{book.genre}</span>}
          <h3 className="book-title">{book.title}</h3>
          <p className="book-author">by {authorName}</p>

          {book.recommendation_reason ? (
            <p className="rec-reason-badge">
              ✦ {book.recommendation_reason}
            </p>
          ) : (
            <p className="book-description">
              {book.description || 'No summary available for this title yet.'}
            </p>
          )}

          {book.tags && book.tags.length > 0 && (
            <div className="book-tags-list">
              {book.tags.slice(0, 3).map((tag) => (
                <span key={tag.id} className="tag-chip">
                  #{tag.name}
                </span>
              ))}
            </div>
          )}
        </div>
      </Link>
    </article>
  );
};

export default BookCard;
