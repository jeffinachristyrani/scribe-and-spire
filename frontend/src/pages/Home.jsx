import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import BookCard from '../components/BookCard';
import Loading from '../components/Loading';

const Home = () => {
  const [featuredBooks, setFeaturedBooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState(null);

  useEffect(() => {
    const fetchFeatured = async () => {
      try {
        setLoading(true);
        const response = await api.get('/books', {
          params: { limit: 4 },
        });
        setFeaturedBooks(response.data);
      } catch (err) {
        console.error('Error fetching featured titles:', err);
        setApiError('FastAPI backend connection error. Make sure Uvicorn is running on http://localhost:8000');
      } finally {
        setLoading(false);
      }
    };

    fetchFeatured();
  }, []);

  return (
    <div className="home-page">
      {/* Hero Section */}
      <section className="hero-section">
        <div className="hero-container">
          <div className="hero-content">
            <span className="hero-eyebrow">❧ A Modern Literary Sanctuary</span>
            <h1 className="hero-title">
              Stories woven with depth, read with analytical clarity.
            </h1>
            <p className="hero-subtitle">
              Scribe & Spire is a serialized literary platform for readers and authors.
              Immerse yourself in original worlds, track your reading trajectory, and experience
              longform prose crafted for the curious mind.
            </p>

            <div className="hero-cta-group">
              <Link to="/library" className="btn-hero-primary">
                Explore the Library
              </Link>
              <Link to="/library" className="btn-hero-secondary">
                Start Reading
              </Link>
            </div>

            <div className="hero-badges">
              <div className="badge-item">
                <span className="badge-bullet">✦</span>
                <span>Serialized Novels & Epics</span>
              </div>
              <div className="badge-item">
                <span className="badge-bullet">✦</span>
                <span>Progress & Bookmark Retention</span>
              </div>
              <div className="badge-item">
                <span className="badge-bullet">✦</span>
                <span>Author Publishing Studio</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Platform Features Section */}
      <section className="features-section">
        <div className="section-container">
          <div className="section-header">
            <span className="section-kicker">Architecture & Ethos</span>
            <h2 className="section-title">Designed for literary immersion</h2>
            <p className="section-description">
              Moving beyond noisy feeds, our reading environment honors narrative depth,
              clean typography, and deep reader focus.
            </p>
          </div>

          <div className="features-grid">
            <div className="feature-card">
              <div className="feature-icon">📖</div>
              <h3>Serene Reading Room</h3>
              <p>
                Distraction-free typography, chapter progression memory, and instant position bookmarking
                across all devices.
              </p>
            </div>

            <div className="feature-card">
              <div className="feature-icon">🖋️</div>
              <h3>Author Publishing Studio</h3>
              <p>
                Writers draft, manage serialized chapters, configure literary tags, and publish stories on
                their own terms.
              </p>
            </div>

            <div className="feature-card">
              <div className="feature-icon">💬</div>
              <h3>Reflective Reader Reviews</h3>
              <p>
                Community reviews and ratings grounded in thoughtful prose commentary rather than algorithmic noise.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Featured Library Section */}
      <section className="featured-section">
        <div className="section-container">
          <div className="featured-header-row">
            <div>
              <span className="section-kicker">Fresh Off the Press</span>
              <h2 className="section-title">Featured Books in Library</h2>
            </div>
            <Link to="/library" className="link-view-all">
              View All Books →
            </Link>
          </div>

          {loading ? (
            <Loading message="Fetching books from library repository..." />
          ) : apiError ? (
            <div className="alert-box alert-warning">
              <p><strong>Note:</strong> {apiError}</p>
              <p className="alert-hint">
                Start the backend in PowerShell: <code>cd e-library/backend; uvicorn main:app --reload</code>
              </p>
            </div>
          ) : featuredBooks.length === 0 ? (
            <div className="empty-state-box">
              <p className="empty-title">The library shelves are currently waiting for stories.</p>
              <p className="empty-subtitle">
                Run <code>python seed.py</code> in the backend to load sample books or create an author account to write the first one!
              </p>
              <Link to="/library" className="btn-primary">
                Browse Library
              </Link>
            </div>
          ) : (
            <div className="books-grid">
              {featuredBooks.map((book) => (
                <BookCard key={book.id} book={book} />
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
};

export default Home;
