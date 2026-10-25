import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../services/api';
import BookCard from '../components/BookCard';
import Loading from '../components/Loading';

const Library = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [books, setBooks] = useState([]);
  const [tags, setTags] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters state initialized from query params
  const [searchTerm, setSearchTerm] = useState(searchParams.get('search') || '');
  const [selectedGenre, setSelectedGenre] = useState(searchParams.get('genre') || '');
  const [selectedTag, setSelectedTag] = useState(searchParams.get('tag') || '');

  // Fetch tags for filter chips
  useEffect(() => {
    const fetchTags = async () => {
      try {
        const response = await api.get('/tags');
        setTags(response.data);
      } catch (err) {
        console.warn('Could not fetch tags:', err.message);
      }
    };
    fetchTags();
  }, []);

  // Fetch books matching current query params
  useEffect(() => {
    const fetchBooks = async () => {
      setLoading(true);
      setError(null);

      const params = {};
      const search = searchParams.get('search');
      const genre = searchParams.get('genre');
      const tag = searchParams.get('tag');

      if (search) params.search = search;
      if (genre) params.genre = genre;
      if (tag) params.tag = tag;

      try {
        const response = await api.get('/books', { params });
        setBooks(response.data);
      } catch (err) {
        console.error('Error fetching library books:', err);
        setError('Failed to load books from server. Please confirm the FastAPI backend is running.');
      } finally {
        setLoading(false);
      }
    };

    fetchBooks();
  }, [searchParams]);

  // Update query params on filter trigger
  const handleSearchSubmit = (e) => {
    e.preventDefault();
    const newParams = {};
    if (searchTerm.trim()) newParams.search = searchTerm.trim();
    if (selectedGenre) newParams.genre = selectedGenre;
    if (selectedTag) newParams.tag = selectedTag;
    setSearchParams(newParams);
  };

  const handleGenreChange = (genre) => {
    const nextGenre = selectedGenre === genre ? '' : genre;
    setSelectedGenre(nextGenre);
    const newParams = {};
    if (searchTerm.trim()) newParams.search = searchTerm.trim();
    if (nextGenre) newParams.genre = nextGenre;
    if (selectedTag) newParams.tag = selectedTag;
    setSearchParams(newParams);
  };

  const handleTagChange = (tagName) => {
    const nextTag = selectedTag === tagName ? '' : tagName;
    setSelectedTag(nextTag);
    const newParams = {};
    if (searchTerm.trim()) newParams.search = searchTerm.trim();
    if (selectedGenre) newParams.genre = selectedGenre;
    if (nextTag) newParams.tag = nextTag;
    setSearchParams(newParams);
  };

  const handleResetFilters = () => {
    setSearchTerm('');
    setSelectedGenre('');
    setSelectedTag('');
    setSearchParams({});
  };

  return (
    <div className="library-page">
      <div className="library-header-banner">
        <div className="section-container">
          <span className="section-kicker">Universal Archive</span>
          <h1 className="page-title">The Grand Library</h1>
          <p className="page-subtitle">
            Explore serial fiction, philosophical treatises, and speculative literature published by our community.
          </p>

          {/* Search bar */}
          <form onSubmit={handleSearchSubmit} className="library-search-form">
            <div className="search-input-wrapper">
              <span className="search-icon">🔍</span>
              <input
                type="text"
                placeholder="Search titles by keyword or character..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="search-input"
              />
            </div>
            <button type="submit" className="btn-primary search-submit-btn">
              Search
            </button>
            {(searchTerm || selectedGenre || selectedTag) && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="btn-outline search-clear-btn"
              >
                Clear Filters
              </button>
            )}
          </form>

          {/* Quick genre selector */}
          <div className="filter-chips-row">
            <span className="filter-label">Genre:</span>
            {['Cyberpunk', 'Fantasy', 'Mystery', 'Adventure', 'Dystopian'].map((genre) => (
              <button
                key={genre}
                type="button"
                className={`chip ${selectedGenre === genre ? 'active' : ''}`}
                onClick={() => handleGenreChange(genre)}
              >
                {genre}
              </button>
            ))}
          </div>

          {/* Tag selector */}
          {tags.length > 0 && (
            <div className="filter-chips-row">
              <span className="filter-label">Tags:</span>
              {tags.map((tag) => (
                <button
                  key={tag.id}
                  type="button"
                  className={`chip chip-tag ${selectedTag === tag.name ? 'active' : ''}`}
                  onClick={() => handleTagChange(tag.name)}
                >
                  #{tag.name}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="section-container library-results-section">
        {loading ? (
          <Loading message="Browsing archival index..." />
        ) : error ? (
          <div className="alert-box alert-danger">
            <p><strong>Error:</strong> {error}</p>
          </div>
        ) : books.length === 0 ? (
          <div className="empty-state-box">
            <p className="empty-title">No books matched your criteria</p>
            <p className="empty-subtitle">
              Try adjusting your search terms or clearing your selected genre filters.
            </p>
            <button onClick={handleResetFilters} className="btn-primary">
              Reset Filters
            </button>
          </div>
        ) : (
          <div>
            <div className="results-count-bar">
              <span>Showing {books.length} {books.length === 1 ? 'title' : 'titles'}</span>
            </div>
            <div className="books-grid">
              {books.map((book) => (
                <BookCard key={book.id} book={book} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Library;
