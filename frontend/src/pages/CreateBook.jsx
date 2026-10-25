import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../services/api';

const CreateBook = () => {
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    cover_image: '',
    genre: 'Fantasy',
  });
  const [availableTags, setAvailableTags] = useState([]);
  const [selectedTagIds, setSelectedTagIds] = useState([]);
  const [newTagInput, setNewTagInput] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  // Fetch tags
  useEffect(() => {
    const fetchTags = async () => {
      try {
        const response = await api.get('/tags');
        setAvailableTags(response.data);
      } catch (err) {
        console.warn('Could not load tags:', err);
      }
    };
    fetchTags();
  }, []);

  const handleChange = (e) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!formData.title.trim()) {
      setError('A title is required for your manuscript.');
      return;
    }

    try {
      setSubmitting(true);
      const payload = {
        title: formData.title.trim(),
        description: formData.description.trim() || null,
        cover_image: formData.cover_image.trim() || null,
        genre: formData.genre.trim() || null,
        tag_ids: selectedTagIds,
      };

      const response = await api.post('/books', payload);
      const createdBook = response.data;

      // Navigate immediately to add the first chapter
      navigate(`/author/books/${createdBook.id}/chapters/create`);
    } catch (err) {
      console.error('Failed to create book:', err);
      const detail = err.response?.data?.detail;
      setError(typeof detail === 'string' ? detail : 'Failed to create book on the backend.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="create-book-page">
      <div className="section-container form-page-container">
        <div className="form-header">
          <div className="details-breadcrumbs">
            <Link to="/author">Author Studio</Link> / <Link to="/author/books">My Books</Link> / <span>New Story</span>
          </div>
          <h1 className="page-title">Begin a New Manuscript</h1>
          <p className="page-subtitle">
            Provide the foundation of your literary universe. You will draft chapters in the next step.
          </p>
        </div>

        {error && <div className="alert-box alert-danger">{error}</div>}

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
              autoFocus
            />
          </div>

          <div className="form-group">
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
            </select>
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
            <span className="field-hint">
              If omitted, our system will generate an aesthetic typographic book jacket for you.
            </span>
          </div>

          <div className="form-group">
            <label htmlFor="description">Synopsis / Blurb</label>
            <textarea
              id="description"
              name="description"
              rows="4"
              value={formData.description}
              onChange={handleChange}
              placeholder="Give readers a compelling glimpse of the conflict, protagonist, or atmosphere..."
              className="textarea-input"
            />
          </div>

          {/* Tags Selection */}
          <div className="form-group">
            <label>Thematic Tags</label>
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

            {/* Quick add custom tag */}
            <div className="inline-add-tag">
              <input
                type="text"
                value={newTagInput}
                onChange={(e) => setNewTagInput(e.target.value)}
                placeholder="Add custom tag (e.g. Slow-burn)"
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
            <Link to="/author/books" className="btn-outline">
              Cancel
            </Link>
            <button type="submit" className="btn-primary" disabled={submitting}>
              {submitting ? 'Creating Story...' : 'Continue to Chapter 1 →'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateBook;
