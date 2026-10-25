import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import Loading from '../components/Loading';

const ManageChapters = () => {
  const { bookId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [book, setBook] = useState(null);
  const [chapters, setChapters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState({ error: null, success: null });
  const [deletingId, setDeletingId] = useState(null);

  const fetchBookAndChapters = async () => {
    try {
      setLoading(true);
      setFeedback({ error: null, success: null });

      // Fetch book details
      const bookRes = await api.get(`/books/${bookId}`);
      const bookData = bookRes.data;

      // Verify ownership
      if (bookData.author_id !== user?.id && user?.role !== 'admin') {
        setFeedback({
          error: "You do not have permission to manage chapters for another author's book.",
          success: null,
        });
        setLoading(false);
        return;
      }

      setBook(bookData);

      // Fetch chapters list in chapter_number order
      const chaptersRes = await api.get(`/books/${bookId}/chapters`);
      // Ensure sorted by chapter_number
      const sorted = [...chaptersRes.data].sort((a, b) => a.chapter_number - b.chapter_number);
      setChapters(sorted);
    } catch (err) {
      console.error('Failed to load book chapters:', err);
      const detail = err.response?.data?.detail;
      setFeedback({
        error: typeof detail === 'string' ? detail : 'Failed to retrieve chapters from backend.',
        success: null,
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.id) {
      fetchBookAndChapters();
    }
  }, [bookId, user]);

  const handleDeleteChapter = async (chapterId, chapterNumber, chapterTitle) => {
    const confirmed = window.confirm(
      `Are you sure you want to permanently delete Chapter ${chapterNumber} — "${chapterTitle}"?\n\nThis action cannot be undone.`
    );
    if (!confirmed) return;

    try {
      setDeletingId(chapterId);
      await api.delete(`/chapters/${chapterId}`);
      setFeedback({
        error: null,
        success: `Chapter ${chapterNumber} — "${chapterTitle}" was successfully deleted.`,
      });
      // Remove chapter from local UI state immediately
      setChapters((prev) => prev.filter((ch) => ch.id !== chapterId));
    } catch (err) {
      console.error('Failed to delete chapter:', err);
      const detail = err.response?.data?.detail;
      setFeedback({
        error: typeof detail === 'string' ? detail : 'Failed to delete chapter. Please try again.',
        success: null,
      });
    } finally {
      setDeletingId(null);
    }
  };

  if (loading) {
    return <Loading message="Loading chapter index..." />;
  }

  return (
    <div className="manage-chapters-page">
      <div className="section-container">
        {/* Navigation Breadcrumbs */}
        <div className="details-breadcrumbs">
          <Link to="/author">Author Studio</Link> /{' '}
          <Link to="/author/books">My Books</Link> /{' '}
          <span>{book ? book.title : 'Book'}</span> / <span>Chapters</span>
        </div>

        {/* Header */}
        <div className="author-studio-header">
          <div>
            <span className="section-kicker">Manuscript Serialization</span>
            <h1 className="page-title">{book?.title || 'Book Chapters'}</h1>
            <p className="page-subtitle">
              Genre: <strong>{book?.genre || 'Unassigned'}</strong> • Status:{' '}
              <span className={`status-pill ${book?.status}`}>
                {book?.status === 'published' ? 'Published' : 'Draft'}
              </span>
            </p>
          </div>

          <div className="header-actions">
            <Link
              to={`/author/books/${bookId}/chapters/create`}
              className="btn-primary"
            >
              + Add New Chapter
            </Link>
            <Link to={`/books/${bookId}`} className="btn-outline">
              View in Library
            </Link>
          </div>
        </div>

        {/* Feedback Banners */}
        {feedback.success && (
          <div className="alert-box alert-success">{feedback.success}</div>
        )}
        {feedback.error && (
          <div className="alert-box alert-danger">{feedback.error}</div>
        )}

        {/* Chapter List Card */}
        <div className="chapters-manage-card">
          <div className="chapters-manage-header">
            <div>
              <h2>Chapter List</h2>
              <span className="chapters-count-sub">
                {chapters.length} {chapters.length === 1 ? 'chapter' : 'chapters'} in this manuscript
              </span>
            </div>
            <Link
              to={`/author/books/${bookId}/chapters/create`}
              className="btn-outline btn-small-action"
            >
              + Write Next Chapter
            </Link>
          </div>

          {chapters.length === 0 ? (
            <div className="empty-state-box">
              <p className="empty-title">No chapters written yet.</p>
              <p className="empty-subtitle">
                Begin your story by publishing Chapter 1 to this manuscript.
              </p>
              <Link
                to={`/author/books/${bookId}/chapters/create`}
                className="btn-primary"
                style={{ marginTop: '1rem', display: 'inline-block' }}
              >
                Write Chapter 1
              </Link>
            </div>
          ) : (
            <div className="manage-chapters-list">
              {chapters.map((ch) => (
                <div key={ch.id} className="manage-chapter-row">
                  <div className="manage-chapter-main">
                    <span className="chapter-label-mono">
                      Chapter {ch.chapter_number}
                    </span>
                    <h3 className="manage-chapter-title">{ch.title}</h3>
                    <div className="manage-chapter-meta">
                      <span>
                        Created: {new Date(ch.created_at).toLocaleDateString()}
                      </span>
                      {ch.updated_at && (
                        <span>
                          • Updated: {new Date(ch.updated_at).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="manage-chapter-actions">
                    <Link
                      to={`/books/${bookId}/read/${ch.id}`}
                      className="btn-outline btn-small-action"
                      title="Preview chapter in Reader"
                    >
                      Read
                    </Link>
                    <Link
                      to={`/author/books/${bookId}/chapters/${ch.id}/edit`}
                      className="btn-primary btn-small-action btn-edit-chapter"
                      title="Edit chapter title, number, or prose"
                    >
                      Edit
                    </Link>
                    <button
                      onClick={() =>
                        handleDeleteChapter(ch.id, ch.chapter_number, ch.title)
                      }
                      disabled={deletingId === ch.id}
                      className="btn-text btn-delete-danger btn-small-action"
                      title="Delete this chapter"
                    >
                      {deletingId === ch.id ? 'Deleting...' : 'Delete'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ marginTop: '2rem' }}>
          <Link to="/author/books" className="btn-outline">
            ← Return to My Books
          </Link>
        </div>
      </div>
    </div>
  );
};

export default ManageChapters;
