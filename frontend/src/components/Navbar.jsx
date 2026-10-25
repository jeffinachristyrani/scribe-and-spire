import React, { useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const Navbar = () => {
  const { user, isAuthenticated, isAuthor, logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/');
    setMobileMenuOpen(false);
  };

  const closeMenu = () => setMobileMenuOpen(false);

  return (
    <header className="site-header">
      <div className="nav-container">
        <Link to="/" className="brand-logo" onClick={closeMenu}>
          <span className="brand-icon">❧</span>
          <span className="brand-text">Scribe & Spire</span>
        </Link>

        {/* Mobile Toggle Button */}
        <button
          className="mobile-toggle"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-label="Toggle navigation menu"
        >
          <span className="toggle-bar"></span>
          <span className="toggle-bar"></span>
          <span className="toggle-bar"></span>
        </button>

        {/* Navigation links */}
        <nav className={`main-nav ${mobileMenuOpen ? 'open' : ''}`}>
          <div className="nav-links">
            <NavLink
              to="/library"
              className={({ isActive }) => (isActive ? 'nav-item active' : 'nav-item')}
              onClick={closeMenu}
            >
              Browse Library
            </NavLink>

            {isAuthenticated && isAuthor && (
              <NavLink
                to="/author"
                className={({ isActive }) => (isActive ? 'nav-item active' : 'nav-item')}
                onClick={closeMenu}
              >
                Author Studio
              </NavLink>
            )}

            {isAuthenticated && (
              <NavLink
                to="/profile"
                className={({ isActive }) => (isActive ? 'nav-item active' : 'nav-item')}
                onClick={closeMenu}
              >
                Reading Profile
              </NavLink>
            )}
          </div>

          <div className="nav-actions">
            {isAuthenticated ? (
              <div className="user-nav-group">
                <Link to="/profile" className="user-greeting" onClick={closeMenu}>
                  <span className="user-avatar-badge">
                    {user?.display_name?.charAt(0).toUpperCase() || user?.username?.charAt(0).toUpperCase() || 'U'}
                  </span>
                  <span className="user-name-label">{user?.display_name || user?.username}</span>
                </Link>
                <button onClick={handleLogout} className="btn-text logout-btn">
                  Sign Out
                </button>
              </div>
            ) : (
              <div className="auth-buttons">
                <Link to="/login" className="btn-secondary" onClick={closeMenu}>
                  Sign In
                </Link>
                <Link to="/register" className="btn-primary" onClick={closeMenu}>
                  Join Platform
                </Link>
              </div>
            )}
          </div>
        </nav>
      </div>
    </header>
  );
};

export default Navbar;
