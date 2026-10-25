import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import api from '../services/api';
import Loading from '../components/Loading';

const CreateChapter = () => {
  const { bookId } = useParams();
  const navigate = useNavigate();

  const [book, setBook] = useState(null);
  const [loadingBook, setLoadingBook] = useState(true);

  const [formData, setFormData] = useState({
    title: '',
    chapter_number: 1,
    content: '',
  });

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchBook = async () => {
      try {
        setLoadingBook(true);
        const response = await api.get(`/books/${bookId}`);
        setBook(response.data);

        // Pre-fill next chapter number
        const nextNum = (response.data.chapters?.length || 0) + 1;
        setFormData((prev) => ({
          ...prev,
          chapter_number: nextNum,
        }));
      } catch (err) {
        console.error('Failed to load book for chapter creation:', err);
        setError('Could not verify book ownership or access manuscript.');
      } finally {
        setLoadingBook(false);
      }
    };

    fetchBook();
  }, [bookId]);

  const handleChange = (e) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  // Word count & reading time stats
  const wordCount = formData.content.trim() ? formData.content.trim().split(/\s+/).length : 0;
  const estimatedReadingMinutes = Math.max(1, Math.round(wordCount / 200));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

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
      await api.post(`/books/${bookId}/chapters`, {
        title: formData.title.trim(),
        chapter_number: parseInt(formData.chapter_number, 10),
        content: formData.content.trim(),
      });

      // Redirect to the book's details page
      navigate(`/books/${bookId}`);
    } catch (err) {
      console.error('Failed to create chapter:', err);
      const detail = err.response?.data?.detail;
      setError(typeof detail === 'string' ? detail : 'Failed to release chapter.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingBook) {
    return <Loading message="Loading manuscript records..." />;
  }

  return (
    <div className="create-chapter-page">
      <div className="section-container form-page-container">
        <div className="form-header">
          <div className="details-breadcrumbs">
            <Link to="/author">Author Studio</Link> /{' '}
            <Link to="/author/books">My Books</Link> /{' '}
            <Link to={`/books/${bookId}`}>{book?.title || 'Book'}</Link> /{' '}
            <span>New Chapter</span>
          </div>

          <h1 className="page-title">Draft New Chapter</h1>
          <p className="page-subtitle">
            Adding serialized chapter to <strong>{book?.title}</strong>
          </p>
        </div>

        {error && <div className="alert-box alert-danger">{error}</div>}

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
                placeholder="e.g. The Midnight Crossing"
                required
                className="input-control"
                autoFocus
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
              placeholder="Write or paste your story text here... Separate paragraphs with blank lines."
              required
              className="textarea-input editor-textarea"
            />
          </div>

          <div className="form-actions-bar">
            <Link to={`/books/${bookId}`} className="btn-outline">
              Discard Changes
            </Link>
            <button type="submit" className="btn-primary" disabled={submitting}>
              {submitting ? 'Saving Chapter...' : 'Publish Chapter to Story →'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateChapter;
