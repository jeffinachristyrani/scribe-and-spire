import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import Loading from '../components/Loading';

const EditBook = () => {
  const { bookId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    cover_image: '',
    genre: 'Fantasy',
    status: 'draft',
  });

  const [availableTags, setAvailableTags] = useState([]);
  const [selectedTagIds, setSelectedTagIds] = useState([]);
  const [newTagInput, setNewTagInput] = useState('');

  // NLP Tag Suggester State
  const [analyzingTags, setAnalyzingTags] = useState(false);
  const [suggestedTags, setSuggestedTags] = useState([]);
  const [tagAnalysisSummary, setTagAnalysisSummary] = useState('');
  const [nlpError, setNlpError] = useState(null);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  useEffect(() => {
    const fetchBookAndTags = async () => {
      try {
        setLoading(true);
        setError(null);

        // Fetch book data
        const bookRes = await api.get(`/books/${bookId}`);
        const bookData = bookRes.data;

        // Verify ownership
        if (bookData.author_id !== user?.id && user?.role !== 'admin') {
          setError("You do not have permission to edit another author's book.");
          setLoading(false);
          return;
        }

        setFormData({
          title: bookData.title || '',
          description: bookData.description || '',
          cover_image: bookData.cover_image || '',
          genre: bookData.genre || 'Fantasy',
          status: bookData.status || 'draft',
        });

        if (bookData.tags) {
          setSelectedTagIds(bookData.tags.map((t) => t.id));
        }

        // Fetch available catalog tags
        const tagsRes = await api.get('/tags');
        setAvailableTags(tagsRes.data);
      } catch (err) {
        console.error('Failed to load book for editing:', err);
        const detail = err.response?.data?.detail;
        setError(typeof detail === 'string' ? detail : 'Could not retrieve book details.');
      } finally {
        setLoading(false);
      }
    };

    if (user?.id) {
      fetchBookAndTags();
    }
  }, [bookId, user]);

  const handleChange = (e) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
    setError(null);
  };

  const handleTagToggle = (tagId) => {
    setSelectedTagIds((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]
    );
  };

  const handleCreateNewTag = async (e) => {
    e.preventDefault();
    if (!newTagInput.trim()) return;

    try {
      const response = await api.post('/tags', { name: newTagInput.trim() });
      const createdTag = response.data;
      if (!availableTags.find((t) => t.id === createdTag.id)) {
        setAvailableTags((prev) => [...prev, createdTag]);
      }
      if (!selectedTagIds.includes(createdTag.id)) {
        setSelectedTagIds((prev) => [...prev, createdTag.id]);
      }
      setNewTagInput('');
    } catch (err) {
      console.error('Failed to create tag:', err);
    }
  };

  // Trigger NLP Content Analysis & Tag Generation
  const handleGenerateTags = async () => {
    try {
      setAnalyzingTags(true);
      setNlpError(null);

      const response = await api.post(`/ml/books/${bookId}/suggest-tags`);
      const { suggested_tags, analysis_summary } = response.data;

      setSuggestedTags(suggested_tags || []);
      setTagAnalysisSummary(analysis_summary || 'Analysis complete.');
    } catch (err) {
      console.error('NLP Tag generation failed:', err);
      const detail = err.response?.data?.detail;
      setNlpError(typeof detail === 'string' ? detail : 'NLP model could not process manuscript text.');
    } finally {
      setAnalyzingTags(false);
    }
  };

  // Accept a suggested tag
  const handleAcceptSuggestedTag = async (tagName) => {
    // Check if tag already exists in availableTags
    let existing = availableTags.find(
      (t) => t.name.toLowerCase() === tagName.toLowerCase()
    );

    if (existing) {
      if (!selectedTagIds.includes(existing.id)) {
        setSelectedTagIds((prev) => [...prev, existing.id]);
      }
    } else {
      // Create new tag in database
      try {
        const response = await api.post('/tags', { name: tagName.toLowerCase() });
        const newTag = response.data;
        setAvailableTags((prev) => [...prev, newTag]);
        setSelectedTagIds((prev) => [...prev, newTag.id]);
      } catch (err) {
        console.error('Failed to register suggested tag:', err);
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    if (!formData.title.trim()) {
      setError('A story title is required.');
      return;
    }

    try {
      setSubmitting(true);
      const payload = {
        title: formData.title.trim(),
        description: formData.description.trim() || null,
        cover_image: formData.cover_image.trim() || null,
        genre: formData.genre.trim() || null,
        status: formData.status,
        tag_ids: selectedTagIds,
      };

      await api.put(`/books/${bookId}`, payload);
      setSuccessMsg('Book details saved successfully! Redirecting...');
      setTimeout(() => {
        navigate(`/author/books/${bookId}/chapters`);
      }, 1200);
    } catch (err) {
      console.error('Failed to update book:', err);
      const detail = err.response?.data?.detail;
      setError(typeof detail === 'string' ? detail : 'Failed to update book details on backend.');
      setSubmitting(false);
    }
  };

  if (loading) {
    return <Loading message="Loading manuscript records..." />;
  }

  return (
    <div className="create-book-page">
      <div className="section-container form-page-container">
        {/* Breadcrumbs */}
        <div className="details-breadcrumbs">
          <Link to="/author">Author Studio</Link> /{' '}
          <Link to="/author/books">My Books</Link> /{' '}
          <Link to={`/author/books/${bookId}/chapters`}>
            {formData.title || 'Book'}
          </Link>{' '}
          / <span>Edit Details</span>
        </div>

        <div className="form-header">
          <span className="section-kicker">Manuscript Metadata & Classification</span>
          <h1 className="page-title">Edit Story Details</h1>
          <p className="page-subtitle">
            Update synopsis, genre, cover image, and leverage NLP AI to suggest thematic tags.
          </p>
        </div>

        {error && <div className="alert-box alert-danger">{error}</div>}
        {successMsg && <div className="alert-box alert-success">{successMsg}</div>}

        <form onSubmit={handleSubmit} className="standard-form-card">
          <div className="form-group">
            <label htmlFor="title">
              Story Title <span className="required-star">*</span>
            </label>
            <input
              type="text"
              id="title"
              name="title"
              value={formData.title}
              onChange={handleChange}
              placeholder="e.g. Whispers of the Amber Sea"
              required
              className="input-control"
            />
          </div>

          <div className="form-row-2col">
            <div className="form-group flex-1">
              <label htmlFor="genre">Primary Genre</label>
              <select
                id="genre"
                name="genre"
                value={formData.genre}
                onChange={handleChange}
                className="select-input"
              >
                <option value="High Fantasy">High Fantasy</option>
                <option value="Sci-Fi / Cyberpunk">Sci-Fi / Cyberpunk</option>
                <option value="Mystery / Detective">Mystery / Detective</option>
                <option value="Literary Fiction">Literary Fiction</option>
                <option value="Adventure">Adventure</option>
                <option value="Dystopian / Post-Apocalyptic">Dystopian / Post-Apocalyptic</option>
                <option value="Historical Fiction">Historical Fiction</option>
                <option value="Horror / Gothic">Horror / Gothic</option>
                <option value="Romance / Drama">Romance / Drama</option>
              </select>
            </div>

            <div className="form-group flex-1">
              <label htmlFor="status">Publication Status</label>
              <select
                id="status"
                name="status"
                value={formData.status}
                onChange={handleChange}
                className="select-input"
              >
                <option value="draft">Draft (Private to author)</option>
                <option value="published">Published (Visible in Library)</option>
              </select>
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="cover_image">Cover Image URL (Optional)</label>
            <input
              type="url"
              id="cover_image"
              name="cover_image"
              value={formData.cover_image}
              onChange={handleChange}
              placeholder="https://images.unsplash.com/... or leave blank for typographic cover"
              className="input-control"
            />
          </div>

          <div className="form-group">
            <label htmlFor="description">Synopsis / Blurb</label>
            <textarea
              id="description"
              name="description"
              rows="4"
              value={formData.description}
              onChange={handleChange}
              placeholder="Describe your story conflict, characters, and atmosphere..."
              className="textarea-input"
            />
          </div>

          {/* ================================================================= */}
          {/* NLP Machine Learning Tag Analysis Section */}
          {/* ================================================================= */}
          <div className="ml-tagger-panel">
            <div className="ml-tagger-header">
              <div>
                <span className="badge-ai-model">NLP Content Analysis</span>
                <h4>AI Thematic Tag Suggester</h4>
                <p className="ml-tagger-sub">
                  Analyzes your manuscript prose and synopsis with TF-IDF keyword extraction to discover literary tropes.
                </p>
              </div>
              <button
                type="button"
                onClick={handleGenerateTags}
                disabled={analyzingTags}
                className="btn-primary btn-ai-action"
              >
                {analyzingTags ? '✨ Analyzing Manuscript...' : '✨ Generate AI Tags'}
              </button>
            </div>

            {nlpError && <div className="alert-box alert-danger" style={{ margin: '0.75rem 0' }}>{nlpError}</div>}

            {tagAnalysisSummary && (
              <p className="nlp-analysis-summary">
                <em>{tagAnalysisSummary}</em>
              </p>
            )}

            {suggestedTags.length > 0 && (
              <div className="nlp-suggestions-box">
                <span className="suggestions-prompt">
                  Click any suggested tag below to include it in your book:
                </span>
                <div className="suggested-chips-grid">
                  {suggestedTags.map((st) => {
                    const alreadySelected = availableTags.some(
                      (t) => t.name.toLowerCase() === st.name.toLowerCase() && selectedTagIds.includes(t.id)
                    );
                    return (
                      <button
                        key={st.name}
                        type="button"
                        onClick={() => handleAcceptSuggestedTag(st.name)}
                        className={`btn-suggested-chip ${alreadySelected ? 'applied' : ''}`}
                        title={st.reason}
                      >
                        <span className="chip-name">#{st.name}</span>
                        <span className="chip-conf">
                          {alreadySelected ? '✓ Included' : `+ Add (${Math.round(st.confidence * 100)}%)`}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Existing Thematic Tags */}
          <div className="form-group" style={{ marginTop: '1.5rem' }}>
            <label>Selected Story Tags</label>
            <div className="tag-picker-container">
              {availableTags.map((tag) => (
                <button
                  key={tag.id}
                  type="button"
                  className={`tag-toggle-btn ${selectedTagIds.includes(tag.id) ? 'selected' : ''}`}
                  onClick={() => handleTagToggle(tag.id)}
                >
                  #{tag.name}
                </button>
              ))}
            </div>

            <div className="inline-add-tag">
              <input
                type="text"
                value={newTagInput}
                onChange={(e) => setNewTagInput(e.target.value)}
                placeholder="Add custom tag (e.g. Political-Intrigue)"
                className="input-control input-small"
              />
              <button
                type="button"
                onClick={handleCreateNewTag}
                className="btn-outline btn-small-action"
              >
                + Add Tag
              </button>
            </div>
          </div>

          <div className="form-actions-bar">
            <Link to={`/author/books/${bookId}/chapters`} className="btn-outline">
              Cancel
            </Link>
            <button type="submit" className="btn-primary" disabled={submitting}>
              {submitting ? 'Saving Changes...' : 'Save Book Details'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditBook;
