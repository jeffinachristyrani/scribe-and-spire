import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import Loading from '../components/Loading';

const AuthorDashboard = () => {
  const { user } = useAuth();
  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchAuthorBooks = async () => {
      try {
        setLoading(true);
        // Include drafts and filter by current author ID
        const response = await api.get('/books', {
          params: {
            author_id: user?.id,
            include_drafts: true,
          },
        });
        setBooks(response.data);
      } catch (err) {
        console.error('Error fetching author books:', err);
        setError('Failed to fetch your author portfolio from the backend.');
      } finally {
        setLoading(false);
      }
    };

    if (user?.id) {
      fetchAuthorBooks();
    }
  }, [user]);

  const publishedCount = books.filter((b) => b.status === 'published').length;
  const draftCount = books.filter((b) => b.status === 'draft').length;

  return (
    <div className="author-dashboard-page">
      <div className="section-container">
        {/* Author Studio Header */}
        <div className="author-studio-header">
          <div>
            <span className="section-kicker">Author Studio & Editorial Desk</span>
            <h1 className="page-title">Welcome to your workshop, {user?.display_name || user?.username}</h1>
            <p className="page-subtitle">
              Draft manuscripts, publish serial chapters, and curate your literary portfolio.
            </p>
          </div>
          <div className="header-actions">
            <Link to="/author/books/create" className="btn-primary">
              + Begin New Story
            </Link>
          </div>
        </div>

        {/* Stats Row */}
        <div className="author-stats-grid">
          <div className="author-stat-card">
            <span className="stat-label">Total Manuscripts</span>
            <strong className="stat-number">{books.length}</strong>
            <span className="stat-help">Authored by you</span>
          </div>

          <div className="author-stat-card">
            <span className="stat-label">Published Works</span>
            <strong className="stat-number published-stat">{publishedCount}</strong>
            <span className="stat-help">Available to readers in Library</span>
          </div>

          <div className="author-stat-card">
            <span className="stat-label">Draft Works</span>
            <strong className="stat-number draft-stat">{draftCount}</strong>
            <span className="stat-help">Private to your account</span>
          </div>
        </div>

        {/* Navigation Quick Links */}
        <div className="author-quick-nav">
          <Link to="/author/books" className="quick-nav-card">
            <div className="quick-icon">📚</div>
            <div className="quick-text">
              <h3>Manage All My Books</h3>
              <p>View chapters, edit metadata, publish or unpublish your books.</p>
            </div>
            <span className="quick-arrow">→</span>
          </Link>

          <Link to="/author/books/create" className="quick-nav-card">
            <div className="quick-icon">✍️</div>
            <div className="quick-text">
              <h3>Create New Book</h3>
              <p>Set title, genre, synopsis, cover, and categorical tags.</p>
            </div>
            <span className="quick-arrow">→</span>
          </Link>
        </div>

        {/* Recent Works Preview */}
        <div className="author-recent-section">
          <div className="section-header-row">
            <h2 className="section-heading">Your Recent Manuscripts</h2>
            <Link to="/author/books" className="link-view-all">
              Manage All ({books.length}) →
            </Link>
          </div>

          {loading ? (
            <Loading message="Loading your library portfolio..." />
          ) : error ? (
            <div className="alert-box alert-danger">{error}</div>
          ) : books.length === 0 ? (
            <div className="empty-state-box">
              <p className="empty-title">You have not created any books yet.</p>
              <p className="empty-subtitle">
                Every great journey begins with a first word. Start drafting your first literary piece now!
              </p>
              <Link to="/author/books/create" className="btn-primary" style={{ marginTop: '1rem', display: 'inline-block' }}>
                Create Your First Book
              </Link>
            </div>
          ) : (
            <div className="author-books-table-wrapper">
              <table className="author-table">
                <thead>
                  <tr>
                    <th>Title</th>
                    <th>Genre</th>
                    <th>Status</th>
                    <th>Created</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {books.slice(0, 5).map((book) => (
                    <tr key={book.id}>
                      <td className="book-title-cell">
                        <Link
                          to={`/author/books/${book.id}/chapters`}
                          className="my-book-title-link"
                          title="Manage Chapters"
                        >
                          <strong>{book.title}</strong>
                        </Link>
                      </td>
                      <td>
                        <span className="genre-chip">{book.genre || 'General'}</span>
                      </td>
                      <td>
                        <span className={`status-pill ${book.status}`}>
                          {book.status === 'published' ? 'Published' : 'Draft'}
                        </span>
                      </td>
                      <td className="table-date">
                        {new Date(book.created_at).toLocaleDateString()}
                      </td>
                      <td className="actions-cell">
                        <Link
                          to={`/author/books/${book.id}/chapters`}
                          className="btn-outline btn-small-action"
                        >
                          Chapters
                        </Link>
                        <Link
                          to={`/author/books/${book.id}/chapters/create`}
                          className="btn-outline btn-small-action"
                          style={{ marginLeft: '0.4rem' }}
                        >
                          + Add
                        </Link>
                        <Link
                          to={`/books/${book.id}`}
                          className="btn-text"
                          style={{ marginLeft: '0.4rem' }}
                        >
                          View
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AuthorDashboard;
