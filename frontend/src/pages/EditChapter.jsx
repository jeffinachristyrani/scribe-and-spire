import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import Loading from '../components/Loading';

const EditChapter = () => {
  const { bookId, chapterId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [book, setBook] = useState(null);
  const [loading, setLoading] = useState(true);

  const [formData, setFormData] = useState({
    title: '',
    chapter_number: 1,
    content: '',
  });

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  useEffect(() => {
    const fetchChapterAndBook = async () => {
      try {
        setLoading(true);
        setError(null);

        // Fetch book to verify ownership
        const bookRes = await api.get(`/books/${bookId}`);
        const bookData = bookRes.data;

        if (bookData.author_id !== user?.id && user?.role !== 'admin') {
          setError("You do not have permission to edit chapters for another author's book.");
          setLoading(false);
          return;
        }
        setBook(bookData);

        // Fetch chapter details
        const chapterRes = await api.get(`/chapters/${chapterId}`);
        const chapterData = chapterRes.data;

        setFormData({
          title: chapterData.title,
          chapter_number: chapterData.chapter_number,
          content: chapterData.content,
        });
      } catch (err) {
        console.error('Failed to load chapter for editing:', err);
        const detail = err.response?.data?.detail;
        setError(typeof detail === 'string' ? detail : 'Failed to retrieve chapter details.');
      } finally {
        setLoading(false);
      }
    };

    if (user?.id) {
      fetchChapterAndBook();
    }
  }, [bookId, chapterId, user]);

  const handleChange = (e) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
    setError(null);
  };

  // Word count & reading time calculation
  const wordCount = formData.content.trim() ? formData.content.trim().split(/\s+/).length : 0;
  const estimatedReadingMinutes = Math.max(1, Math.round(wordCount / 200));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    if (!formData.title.trim()) {
      setError('Chapter title is required.');
      return;
    }
    if (!formData.content.trim()) {
      setError('Chapter text content cannot be blank.');
      return;
    }

    try {
      setSubmitting(true);
      await api.put(`/chapters/${chapterId}`, {
        title: formData.title.trim(),
        chapter_number: parseInt(formData.chapter_number, 10),
        content: formData.content.trim(),
      });

      setSuccessMsg('Chapter saved successfully! Redirecting...');
      // Return to the book's chapter list
      setTimeout(() => {
        navigate(`/author/books/${bookId}/chapters`);
      }, 1200);
    } catch (err) {
      console.error('Failed to save chapter:', err);
      const detail = err.response?.data?.detail;
      setError(typeof detail === 'string' ? detail : 'Failed to update chapter.');
      setSubmitting(false);
    }
  };

  if (loading) {
    return <Loading message="Loading chapter manuscript..." />;
  }

  return (
    <div className="create-chapter-page">
      <div className="section-container form-page-container">
        {/* Navigation Breadcrumbs */}
        <div className="details-breadcrumbs">
          <Link to="/author">Author Studio</Link> /{' '}
          <Link to="/author/books">My Books</Link> /{' '}
          <Link to={`/author/books/${bookId}/chapters`}>
            {book?.title || 'Book'} Chapters
          </Link>{' '}
          / <span>Edit Chapter {formData.chapter_number}</span>
        </div>

        <div className="form-header">
          <span className="section-kicker">Manuscript Revision</span>
          <h1 className="page-title">Edit Chapter {formData.chapter_number}</h1>
          <p className="page-subtitle">
            Editing chapter in <strong>{book?.title}</strong>
          </p>
        </div>

        {error && <div className="alert-box alert-danger">{error}</div>}
        {successMsg && <div className="alert-box alert-success">{successMsg}</div>}

        <form onSubmit={handleSubmit} className="standard-form-card chapter-editor-card">
          <div className="form-row-2col">
            <div className="form-group flex-2">
              <label htmlFor="title">
                Chapter Title <span className="required-star">*</span>
              </label>
              <input
                type="text"
                id="title"
                name="title"
                value={formData.title}
                onChange={handleChange}
                placeholder="e.g. The Awakening"
                required
                className="input-control"
              />
            </div>

            <div className="form-group flex-1">
              <label htmlFor="chapter_number">Chapter Number</label>
              <input
                type="number"
                id="chapter_number"
                name="chapter_number"
                min="1"
                value={formData.chapter_number}
                onChange={handleChange}
                required
                className="input-control"
              />
            </div>
          </div>

          <div className="form-group">
            <div className="editor-label-row">
              <label htmlFor="content">
                Manuscript Prose <span className="required-star">*</span>
              </label>
              <div className="editor-stats">
                <span>{wordCount} words</span> • <span>~{estimatedReadingMinutes} min read</span>
              </div>
            </div>

            <textarea
              id="content"
              name="content"
              rows="16"
              value={formData.content}
              onChange={handleChange}
              placeholder="Write or edit your story text here... Separate paragraphs with blank lines."
              required
              className="textarea-input editor-textarea"
            />
          </div>

          <div className="form-actions-bar">
            <button
              type="button"
              onClick={() => navigate(`/author/books/${bookId}/chapters`)}
              className="btn-outline"
              disabled={submitting}
            >
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={submitting}>
              {submitting ? 'Saving Changes...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditChapter;
