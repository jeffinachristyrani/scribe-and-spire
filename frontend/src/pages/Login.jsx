import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const Login = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [formData, setFormData] = useState({
    username_or_email: '',
    password: '',
  });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const redirectPath = location.state?.from?.pathname || '/library';

  const handleChange = (e) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!formData.username_or_email || !formData.password) {
      setError('Please provide your username or email and password.');
      return;
    }

    try {
      setSubmitting(true);
      await login(formData.username_or_email, formData.password);
      navigate(redirectPath, { replace: true });
    } catch (err) {
      console.error('Login error:', err);
      const detail = err.response?.data?.detail;
      setError(
        typeof detail === 'string'
          ? detail
          : 'Unable to sign in. Please check your credentials or backend server status.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  // Quick fill helper for testing sample seeded users
  const handleQuickFill = (role) => {
    if (role === 'author') {
      setFormData({
        username_or_email: 'author_elena',
        password: 'author123',
      });
    } else {
      setFormData({
        username_or_email: 'reader_lucas',
        password: 'reader123',
      });
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-header">
          <span className="auth-icon">❧</span>
          <h1 className="auth-title">Welcome Back</h1>
          <p className="auth-subtitle">Sign in to your reading and writing sanctuary</p>
        </div>

        {error && <div className="alert-box alert-danger">{error}</div>}

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label htmlFor="username_or_email">Username or Email</label>
            <input
              type="text"
              id="username_or_email"
              name="username_or_email"
              value={formData.username_or_email}
              onChange={handleChange}
              placeholder="e.g. author_elena or reader_lucas"
              required
              autoFocus
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              type="password"
              id="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              placeholder="••••••••"
              required
            />
          </div>

          <button type="submit" className="btn-primary btn-block" disabled={submitting}>
            {submitting ? 'Authenticating...' : 'Sign In to Platform'}
          </button>
        </form>

        {/* Demo Quick-Fill Buttons for easy evaluation */}
        <div className="demo-credentials-box">
          <span className="demo-label">Quick fill sample accounts:</span>
          <div className="demo-btn-group">
            <button
              type="button"
              className="btn-pill"
              onClick={() => handleQuickFill('author')}
            >
              Author (Elena)
            </button>
            <button
              type="button"
              className="btn-pill"
              onClick={() => handleQuickFill('reader')}
            >
              Reader (Lucas)
            </button>
          </div>
        </div>

        <div className="auth-footer">
          <p>
            Do not have an account yet?{' '}
            <Link to="/register" className="auth-link">
              Create an account
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
