import React from 'react';
import { Link } from 'react-router-dom';

const Footer = () => {
  return (
    <footer className="site-footer">
      <div className="footer-container">
        <div className="footer-brand">
          <div className="brand-logo">
            <span className="brand-icon">❧</span>
            <span className="brand-text">Scribe & Spire</span>
          </div>
          <p className="footer-tagline">
            An open sanctuary for literature, longform serialized storytelling, and analytical reading.
          </p>
        </div>

        <div className="footer-nav">
          <div className="footer-col">
            <h4>Explore</h4>
            <ul>
              <li><Link to="/library">All Titles</Link></li>
              <li><Link to="/library?genre=Cyberpunk">Cyberpunk</Link></li>
              <li><Link to="/library?genre=Fantasy">Fantasy & Myth</Link></li>
            </ul>
          </div>

          <div className="footer-col">
            <h4>Writers</h4>
            <ul>
              <li><Link to="/author">Author Studio</Link></li>
              <li><Link to="/author/books/create">Publish a Story</Link></li>
              <li><Link to="/register">Create Author Account</Link></li>
            </ul>
          </div>

          <div className="footer-col">
            <h4>System</h4>
            <ul>
              <li><a href="http://localhost:8000/docs" target="_blank" rel="noreferrer">FastAPI Docs</a></li>
              <li><Link to="/profile">Reader Activity</Link></li>
            </ul>
          </div>
        </div>
      </div>

      <div className="footer-bottom">
        <p>© {new Date().getFullYear()} Scribe & Spire Literary Platform. Powered by FastAPI & React.</p>
        <span className="footer-badge">Analytical Reading System</span>
      </div>
    </footer>
  );
};

export default Footer;
