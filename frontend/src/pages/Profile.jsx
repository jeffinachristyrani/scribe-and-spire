import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import Loading from '../components/Loading';
import BookCard from '../components/BookCard';

const Profile = () => {
  const { user, setUser } = useAuth();

  const [bookmarks, setBookmarks] = useState([]);
  const [history, setHistory] = useState([]);
  const [loadingActivity, setLoadingActivity] = useState(true);

  // Recommendations State
  const [recommendations, setRecommendations] = useState([]);
  const [userCluster, setUserCluster] = useState(null);
  const [loadingRecs, setLoadingRecs] = useState(true);
  const [recsError, setRecsError] = useState(null);

  // Profile Edit State
  const [isEditing, setIsEditing] = useState(false);
  const [displayName, setDisplayName] = useState(user?.display_name || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [updateMsg, setUpdateMsg] = useState({ error: null, success: null });
  const [savingProfile, setSavingProfile] = useState(false);

  useEffect(() => {
    if (user) {
      setDisplayName(user.display_name || '');
      setBio(user.bio || '');
    }
  }, [user]);

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        setLoadingActivity(true);
        const [bookmarksRes, historyRes] = await Promise.all([
          api.get('/reading/bookmarks'),
          api.get('/reading/history'),
        ]);
        setBookmarks(bookmarksRes.data);
        setHistory(historyRes.data);
      } catch (err) {
        console.error('Failed to load user activity:', err);
      } finally {
        setLoadingActivity(false);
      }
    };

    fetchUserData();
  }, []);

  useEffect(() => {
    const fetchRecommendations = async () => {
      try {
        setLoadingRecs(true);
        setRecsError(null);
        const res = await api.get('/ml/recommendations');
        setRecommendations(res.data?.top_picks || []);
        setUserCluster(res.data?.user_cluster || null);
      } catch (err) {
        console.error('Failed to load personalized recommendations:', err);
        setRecsError('Could not load personalized recommendations at this time.');
      } finally {
        setLoadingRecs(false);
      }
    };

    if (user) {
      fetchRecommendations();
    }
  }, [user]);

  const handleProfileUpdate = async (e) => {
    e.preventDefault();
    setUpdateMsg({ error: null, success: null });

    try {
      setSavingProfile(true);
      const response = await api.put('/users/me', {
        display_name: displayName.trim() || null,
        bio: bio.trim() || null,
      });
      setUser(response.data);
      setUpdateMsg({ error: null, success: 'Profile successfully updated!' });
      setIsEditing(false);
    } catch (err) {
      console.error('Error updating profile:', err);
      setUpdateMsg({ error: 'Failed to update profile.', success: null });
    } finally {
      setSavingProfile(false);
    }
  };

  const handleDeleteBookmark = async (bookmarkId) => {
    try {
      await api.delete(`/reading/bookmarks/${bookmarkId}`);
      setBookmarks((prev) => prev.filter((b) => b.id !== bookmarkId));
    } catch (err) {
      console.error('Failed to delete bookmark:', err);
    }
  };

  return (
    <div className="profile-page">
      <div className="section-container">
        {/* User Profile Card */}
        <div className="profile-header-card">
          <div className="profile-avatar-large">
            {user?.display_name?.charAt(0).toUpperCase() || user?.username?.charAt(0).toUpperCase() || 'U'}
          </div>

          <div className="profile-details-column">
            <div className="profile-badge-row">
              <span className={`role-badge ${user?.role}`}>{user?.role?.toUpperCase()}</span>
              <span className="join-date">
                Member since {new Date(user?.created_at).toLocaleDateString()}
              </span>
            </div>

            <h1 className="profile-name">{user?.display_name || user?.username}</h1>
            <p className="profile-username">@{user?.username} • {user?.email}</p>

            {user?.bio ? (
              <p className="profile-bio">{user.bio}</p>
            ) : (
              <p className="profile-bio-empty">No author or reader biography added yet.</p>
            )}

            <button
              onClick={() => setIsEditing(!isEditing)}
              className="btn-outline btn-small-action"
            >
              {isEditing ? 'Cancel Editing' : '✎ Edit Profile'}
            </button>

            {updateMsg.success && (
              <div className="alert-box alert-success" style={{ marginTop: '0.75rem' }}>
                {updateMsg.success}
              </div>
            )}
            {updateMsg.error && (
              <div className="alert-box alert-danger" style={{ marginTop: '0.75rem' }}>
                {updateMsg.error}
              </div>
            )}
          </div>
        </div>

        {/* Profile Edit Drawer */}
        {isEditing && (
          <div className="edit-profile-card">
            <h3>Update Profile Information</h3>
            <form onSubmit={handleProfileUpdate}>
              <div className="form-group">
                <label>Display Name (Pen Name)</label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="e.g. Mary Shelley"
                  className="input-control"
                />
              </div>

              <div className="form-group">
                <label>Reader / Author Bio</label>
                <textarea
                  rows="3"
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Write a few lines about your literary interests, writing projects, or favorite genres..."
                  className="textarea-input"
                />
              </div>

              <button type="submit" className="btn-primary" disabled={savingProfile}>
                {savingProfile ? 'Saving...' : 'Save Profile Changes'}
              </button>
            </form>
          </div>
        )}

        {/* Reader Activity Section */}
        <div className="activity-tabs-grid">
          {/* Saved Bookmarks */}
          <div className="activity-card">
            <div className="activity-card-header">
              <h2>🔖 Saved Bookmarks</h2>
              <span className="count-pill">{bookmarks.length}</span>
            </div>

            {loadingActivity ? (
              <Loading message="Loading bookmarks..." />
            ) : bookmarks.length === 0 ? (
              <div className="empty-box">
                <p>No saved bookmarks yet. While reading any chapter, click "Bookmark" to save your spot.</p>
              </div>
            ) : (
              <div className="activity-list">
                {bookmarks.map((bm) => (
                  <div key={bm.id} className="activity-item">
                    <div className="activity-item-info">
                      <strong>Book #{bm.book_id}</strong>
                      <span className="activity-sub">Chapter #{bm.chapter_id}</span>
                      <span className="activity-date">
                        Saved {new Date(bm.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="activity-actions">
                      <Link
                        to={`/books/${bm.book_id}/read/${bm.chapter_id}`}
                        className="btn-outline btn-small-action"
                      >
                        Resume →
                      </Link>
                      <button
                        onClick={() => handleDeleteBookmark(bm.id)}
                        className="btn-text btn-delete-small"
                        title="Remove bookmark"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Reading History */}
          <div className="activity-card">
            <div className="activity-card-header">
              <h2>🕒 Reading History</h2>
              <span className="count-pill">{history.length}</span>
            </div>

            {loadingActivity ? (
              <Loading message="Loading history..." />
            ) : history.length === 0 ? (
              <div className="empty-box">
                <p>No recorded reading history yet. Read a chapter from the Library to begin tracking your activity.</p>
              </div>
            ) : (
              <div className="activity-list">
                {history.map((h) => (
                  <div key={h.id} className="activity-item">
                    <div className="activity-item-info">
                      <strong>Book #{h.book_id}</strong>
                      <span className="activity-sub">Chapter #{h.chapter_id}</span>
                      <span className="activity-date">
                        Last read {new Date(h.last_read_at).toLocaleDateString()}
                      </span>
                    </div>
                    <Link
                      to={`/books/${h.book_id}/read/${h.chapter_id}`}
                      className="btn-outline btn-small-action"
                    >
                      Revisit →
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Recommended For You Section */}
        <section className="profile-recommendations-section">
          <div className="section-header-row">
            <div>
              <h2 className="section-heading">✨ Recommended for You</h2>
              <p className="profile-bio-empty" style={{ margin: '0.25rem 0 0 0' }}>
                Personalized book picks curated by AI reader clustering & collaborative filtering
              </p>
            </div>
            {userCluster && userCluster.persona_name && (
              <div className="persona-profile-badge" title={userCluster.persona_description}>
                <span className="persona-badge-label">Reader Archetype</span>
                <span className="persona-badge-title">📖 {userCluster.persona_name}</span>
              </div>
            )}
          </div>

          {loadingRecs ? (
            <Loading message="Curating personalized book recommendations..." />
          ) : recsError ? (
            <div className="alert-box alert-warning">
              {recsError}
            </div>
          ) : recommendations.length === 0 ? (
            <div className="empty-box">
              <p>No recommendations available yet. Browse the library and read a few chapters to discover new books!</p>
              <Link to="/library" className="btn-outline btn-small-action" style={{ marginTop: '0.75rem', display: 'inline-block' }}>
                Explore Library →
              </Link>
            </div>
          ) : (
            <div className="books-grid">
              {recommendations.map((book) => (
                <BookCard key={book.id} book={book} />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export default Profile;
