import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import Loading from '../components/Loading';

const MyBooks = () => {
  const { user } = useAuth();
  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionFeedback, setActionFeedback] = useState({ error: null, success: null });

  const fetchBooks = async () => {
    try {
      setLoading(true);
      const response = await api.get('/books', {
        params: {
          author_id: user?.id,
          include_drafts: true,
        },
      });
      setBooks(response.data);
    } catch (err) {
      console.error('Failed to load books:', err);
      setActionFeedback({ error: 'Failed to retrieve books from server.', success: null });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.id) {
      fetchBooks();
    }
  }, [user]);

  // Toggle publish / unpublish
  const handleTogglePublish = async (bookId, currentStatus) => {
    const shouldPublish = currentStatus !== 'published';
    setActionFeedback({ error: null, success: null });

    try {
      await api.patch(`/books/${bookId}/publish`, null, {
        params: { publish: shouldPublish },
      });
      setActionFeedback({
        error: null,
        success: `Book status updated to ${shouldPublish ? 'Published' : 'Draft'}.`,
      });
      fetchBooks();
    } catch (err) {
      console.error('Error toggling publish status:', err);
      setActionFeedback({
        error: err.response?.data?.detail || 'Failed to update publication status.',
        success: null,
      });
    }
  };

  // Delete book
  const handleDeleteBook = async (bookId, title) => {
    if (!window.confirm(`Are you sure you want to permanently delete "${title}" and all its chapters?`)) {
      return;
    }

    try {
      await api.delete(`/books/${bookId}`);
      setActionFeedback({
        error: null,
        success: `"${title}" has been deleted.`,
      });
      fetchBooks();
    } catch (err) {
      console.error('Error deleting book:', err);
      setActionFeedback({
        error: err.response?.data?.detail || 'Failed to delete book.',
        success: null,
      });
    }
  };

  return (
    <div className="my-books-page">
      <div className="section-container">
        <div className="author-studio-header">
          <div>
            <div className="details-breadcrumbs">
              <Link to="/author">Author Studio</Link> / <span>My Books</span>
            </div>
            <h1 className="page-title">My Authored Books</h1>
            <p className="page-subtitle">
              Manage your catalog, add chapters, and control story publication visibility.
            </p>
          </div>

          <div className="header-actions">
            <Link to="/author/books/create" className="btn-primary">
              + New Book
            </Link>
          </div>
        </div>

        {actionFeedback.success && (
          <div className="alert-box alert-success">{actionFeedback.success}</div>
        )}
        {actionFeedback.error && (
          <div className="alert-box alert-danger">{actionFeedback.error}</div>
        )}

        {loading ? (
          <Loading message="Fetching your authored books..." />
        ) : books.length === 0 ? (
          <div className="empty-state-box">
            <p className="empty-title">You haven't authored any books yet.</p>
            <p className="empty-subtitle">
              Ready to begin your literary legacy? Create your first story.
            </p>
            <Link to="/author/books/create" className="btn-primary" style={{ marginTop: '1rem', display: 'inline-block' }}>
              Create Book
            </Link>
          </div>
        ) : (
          <div className="my-books-list">
            {books.map((book) => (
              <div key={book.id} className="my-book-row-card">
                <div className="my-book-cover-thumb">
                  <Link to={`/author/books/${book.id}/chapters`} title="Manage Chapters">
                    {book.cover_image ? (
                      <img src={book.cover_image} alt={book.title} />
                    ) : (
                      <div className="thumb-placeholder">
                        <span>{book.title.charAt(0)}</span>
                      </div>
                    )}
                  </Link>
                </div>

                <div className="my-book-main-info">
                  <div className="my-book-header-line">
                    <h3>
                      <Link
                        to={`/author/books/${book.id}/chapters`}
                        className="my-book-title-link"
                        title="Open Chapter List"
                      >
                        {book.title}
                      </Link>
                    </h3>
                    <span className={`status-pill ${book.status}`}>
                      {book.status === 'published' ? 'Published' : 'Draft'}
                    </span>
                  </div>

                  <p className="my-book-genre">
                    Genre: <strong>{book.genre || 'Unassigned'}</strong> • Created:{' '}
                    {new Date(book.created_at).toLocaleDateString()}
                  </p>

                  <p className="my-book-snippet">
                    {book.description || 'No description provided.'}
                  </p>

                  {book.tags && book.tags.length > 0 && (
                    <div className="book-tags-list" style={{ marginTop: '0.5rem' }}>
                      {book.tags.map((t) => (
                        <span key={t.id} className="tag-chip">#{t.name}</span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="my-book-actions-group">
                  <Link
                    to={`/author/books/${book.id}/chapters`}
                    className="btn-primary btn-small-action"
                  >
                    📖 Chapter List
                  </Link>

                  <Link
                    to={`/author/books/${book.id}/chapters/create`}
                    className="btn-outline btn-small-action"
                  >
                    + Add Chapter
                  </Link>

                  <Link
                    to={`/author/books/${book.id}/edit`}
                    className="btn-outline btn-small-action"
                    title="Edit story synopsis, genre, cover, or use AI tag suggester"
                  >
                    ✎ Edit Details
                  </Link>

                  <button
                    onClick={() => handleTogglePublish(book.id, book.status)}
                    className="btn-outline btn-small-action"
                  >
                    {book.status === 'published' ? 'Unpublish' : 'Publish Story'}
                  </button>

                  <Link
                    to={`/books/${book.id}`}
                    className="btn-outline btn-small-action"
                  >
                    View in Library
                  </Link>

                  <button
                    onClick={() => handleDeleteBook(book.id, book.title)}
                    className="btn-text btn-delete-danger"
                  >
                    Delete Story
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default MyBooks;
