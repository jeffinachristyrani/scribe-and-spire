import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const Register = () => {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    display_name: '',
    role: 'reader',
  });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

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

    if (formData.password.length < 6) {
      setError('Password should be at least 6 characters long.');
      return;
    }

    try {
      setSubmitting(true);
      await register(formData);
      navigate('/library', { replace: true });
    } catch (err) {
      console.error('Registration error:', err);
      const detail = err.response?.data?.detail;
      setError(
        typeof detail === 'string'
          ? detail
          : 'Registration failed. The username or email might already be registered.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-header">
          <span className="auth-icon">❧</span>
          <h1 className="auth-title">Join the Sanctuary</h1>
          <p className="auth-subtitle">Create your reader or author membership</p>
        </div>

        {error && <div className="alert-box alert-danger">{error}</div>}

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label htmlFor="username">Username</label>
            <input
              type="text"
              id="username"
              name="username"
              value={formData.username}
              onChange={handleChange}
              placeholder="e.g. sylvia_plath"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="email">Email Address</label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="sylvia@example.com"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="display_name">Display Name (Pen Name)</label>
            <input
              type="text"
              id="display_name"
              name="display_name"
              value={formData.display_name}
              onChange={handleChange}
              placeholder="e.g. Sylvia P."
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
              placeholder="Minimum 6 characters"
              required
            />
          </div>

          <div className="form-group">
            <label>Primary Account Role</label>
            <div className="role-selector-group">
              <label className={`role-radio-card ${formData.role === 'reader' ? 'selected' : ''}`}>
                <input
                  type="radio"
                  name="role"
                  value="reader"
                  checked={formData.role === 'reader'}
                  onChange={handleChange}
                />
                <div className="role-radio-info">
                  <strong>Reader</strong>
                  <span>Browse stories, save bookmarks, leave ratings & reviews</span>
                </div>
              </label>

              <label className={`role-radio-card ${formData.role === 'author' ? 'selected' : ''}`}>
                <input
                  type="radio"
                  name="role"
                  value="author"
                  checked={formData.role === 'author'}
                  onChange={handleChange}
                />
                <div className="role-radio-info">
                  <strong>Author</strong>
                  <span>Publish books, draft chapters, and manage serialized works</span>
                </div>
              </label>
            </div>
          </div>

          <button type="submit" className="btn-primary btn-block" disabled={submitting}>
            {submitting ? 'Registering Account...' : 'Create Account'}
          </button>
        </form>

        <div className="auth-footer">
          <p>
            Already have an account?{' '}
            <Link to="/login" className="auth-link">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Register;
