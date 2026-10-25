import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import Loading from '../components/Loading';

const Reader = () => {
  const { id: bookId, chapterId } = useParams();
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const [chapter, setChapter] = useState(null);
  const [allChapters, setAllChapters] = useState([]);
  const [bookTitle, setBookTitle] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Quick Chapter Navigation Panel & Drawer State
  const [showChapterNav, setShowChapterNav] = useState(true);
  const [showDrawer, setShowDrawer] = useState(false);

  // Bookmark & Progress State
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [bookmarkId, setBookmarkId] = useState(null);
  const [bookmarkMsg, setBookmarkMsg] = useState('');
  const [readingProgressPct, setReadingProgressPct] = useState(0); // Chapter milestone %

  // Scroll Progress Tracking for Review Eligibility (Requirement: >= 20% content scroll)
  const [contentScrollPct, setContentScrollPct] = useState(0);
  const maxScrollRef = useRef(0);
  const lastReportedScrollRef = useRef(0);
  const lastScrollTimeRef = useRef(0);

  // Reading appearance preferences
  const [fontSize, setFontSize] = useState('medium'); // small, medium, large
  const [themeMode, setThemeMode] = useState('dark'); // dark, sepia, black

  // Fetch chapter and book chapters list
  useEffect(() => {
    const fetchReaderData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Fetch current chapter content
        const chapterRes = await api.get(`/chapters/${chapterId}`);
        setChapter(chapterRes.data);

        // Fetch full chapter list for previous / next navigation and progress
        const chaptersListRes = await api.get(`/books/${bookId}/chapters`);
        // Sort in chapter_number order
        const chaptersList = [...chaptersListRes.data].sort(
          (a, b) => a.chapter_number - b.chapter_number
        );
        setAllChapters(chaptersList);

        // Fetch book metadata for title
        try {
          const bookRes = await api.get(`/books/${bookId}`);
          setBookTitle(bookRes.data.title);
        } catch {
          setBookTitle(`Book #${bookId}`);
        }

        // Calculate progress percentage based on chapter position
        const currentIndex = chaptersList.findIndex((ch) => ch.id === parseInt(chapterId, 10));
        if (currentIndex !== -1 && chaptersList.length > 0) {
          const pct = Math.round(((currentIndex + 1) / chaptersList.length) * 100);
          setReadingProgressPct(pct);

          // If authenticated, automatically record progress & history in the backend
          if (localStorage.getItem('token')) {
            api.post('/reading/progress', {
              book_id: parseInt(bookId, 10),
              chapter_id: parseInt(chapterId, 10),
              progress_percentage: pct,
            }).catch(() => {});

            api.post('/reading/history', {
              book_id: parseInt(bookId, 10),
              chapter_id: parseInt(chapterId, 10),
            }).catch(() => {});
          }
        }

        // Check if current chapter is bookmarked
        if (localStorage.getItem('token')) {
          try {
            const bookmarksRes = await api.get('/reading/bookmarks', {
              params: { book_id: parseInt(bookId, 10) },
            });
            const match = bookmarksRes.data.find((b) => b.chapter_id === parseInt(chapterId, 10));
            if (match) {
              setIsBookmarked(true);
              setBookmarkId(match.id);
            } else {
              setIsBookmarked(false);
              setBookmarkId(null);
            }
          } catch {
            // Non-critical
          }
        }
      } catch (err) {
        console.error('Error loading chapter:', err);
        const detail = err.response?.data?.detail;
        setError(detail || 'Failed to load chapter content from backend.');
      } finally {
        setLoading(false);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    };

    fetchReaderData();
  }, [bookId, chapterId]);

  // Vertical scroll tracking for chapter content (requirement: scroll at least 20% to unlock reviews)
  useEffect(() => {
    // Reset scroll progress tracking on chapter change
    maxScrollRef.current = 0;
    lastReportedScrollRef.current = 0;
    lastScrollTimeRef.current = Date.now();
    setContentScrollPct(0);

    const handleScroll = () => {
      let pct = 0;
      const bodyEl = document.querySelector('.manuscript-body');

      if (bodyEl) {
        const rect = bodyEl.getBoundingClientRect();
        const bodyHeight = bodyEl.offsetHeight;
        if (bodyHeight <= window.innerHeight) {
          // Short prose that fits entirely within the viewport
          pct = 100;
        } else {
          // Measures actual readable manuscript content scrolled
          const scrolledPast = -rect.top;
          const maxScrollableProse = bodyHeight - window.innerHeight;
          pct = Math.min(100, Math.max(0, Math.round((scrolledPast / maxScrollableProse) * 100)));
        }
      } else {
        const docHeight = document.documentElement.scrollHeight;
        const winHeight = window.innerHeight;
        const scrollTop = window.scrollY || document.documentElement.scrollTop;
        const scrollable = docHeight - winHeight;
        pct = scrollable <= 60 ? 100 : Math.min(100, Math.max(0, Math.round((scrollTop / scrollable) * 100)));
      }

      if (pct > maxScrollRef.current) {
        maxScrollRef.current = pct;
        setContentScrollPct(pct);

        const now = Date.now();
        const timeDiff = now - lastScrollTimeRef.current;
        const pctDiff = pct - lastReportedScrollRef.current;

        // Report to backend when crossing 20% milestone, every 15% progression after 2s, or on completion
        const shouldReport =
          (lastReportedScrollRef.current < 20 && pct >= 20) ||
          (pctDiff >= 15 && timeDiff >= 2000) ||
          (pct === 100 && lastReportedScrollRef.current < 100);

        if (shouldReport && localStorage.getItem('token')) {
          lastReportedScrollRef.current = pct;
          lastScrollTimeRef.current = now;

          api.post('/reading/scroll-progress', {
            book_id: parseInt(bookId, 10),
            chapter_id: parseInt(chapterId, 10),
            scroll_percentage: pct,
          }).catch((err) => {
            console.debug('Scroll tracking update:', err.message);
          });
        }
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    // Check initial view after rendering
    const initialCheckTimer = setTimeout(handleScroll, 800);

    return () => {
      window.removeEventListener('scroll', handleScroll);
      clearTimeout(initialCheckTimer);
    };
  }, [bookId, chapterId]);

  // Toggle bookmark handler
  const handleToggleBookmark = async () => {
    if (!isAuthenticated) {
      setBookmarkMsg('Please sign in to save your bookmark.');
      setTimeout(() => setBookmarkMsg(''), 3000);
      return;
    }

    try {
      if (isBookmarked && bookmarkId) {
        await api.delete(`/reading/bookmarks/${bookmarkId}`);
        setIsBookmarked(false);
        setBookmarkId(null);
        setBookmarkMsg('Bookmark removed.');
      } else {
        const response = await api.post('/reading/bookmarks', {
          book_id: parseInt(bookId, 10),
          chapter_id: parseInt(chapterId, 10),
          position: Math.round(window.scrollY),
        });
        setIsBookmarked(true);
        setBookmarkId(response.data.id);
        setBookmarkMsg('Bookmark saved at current chapter.');
      }
    } catch (err) {
      setBookmarkMsg('Failed to update bookmark.');
    }
    setTimeout(() => setBookmarkMsg(''), 3000);
  };

  if (loading) {
    return <Loading message="Opening chapter..." />;
  }

  if (error || !chapter) {
    return (
      <div className="section-container" style={{ padding: '4rem 1.5rem' }}>
        <div className="alert-box alert-danger">
          <h3>Unable to Load Chapter</h3>
          <p>{error}</p>
          <Link to={`/books/${bookId}`} className="btn-primary" style={{ marginTop: '1rem', display: 'inline-block' }}>
            Back to Book Details
          </Link>
        </div>
      </div>
    );
  }

  // Determine previous and next chapters based on chapter_number order
  const currentIndex = allChapters.findIndex((ch) => ch.id === parseInt(chapterId, 10));
  const prevChapter = currentIndex > 0 ? allChapters[currentIndex - 1] : null;
  const nextChapter = currentIndex !== -1 && currentIndex < allChapters.length - 1 ? allChapters[currentIndex + 1] : null;

  return (
    <div className={`reader-page theme-${themeMode}`}>
      {/* Sticky Reader Topbar */}
      <header className="reader-topbar">
        <div className="reader-topbar-container">
          <div className="reader-topbar-left">
            <Link to={`/books/${bookId}`} className="back-link">
              ← Return to Book
            </Link>
            <span className="reader-book-title">{bookTitle}</span>
          </div>

          <div className="reader-topbar-center">
            <span className="reader-progress-label">
              Chapter {chapter.chapter_number} of {allChapters.length} ({readingProgressPct}%)
            </span>
            <div className="reader-progress-track">
              <div
                className="reader-progress-bar"
                style={{ width: `${readingProgressPct}%` }}
              ></div>
            </div>
          </div>

          <div className="reader-topbar-right">
            {/* Quick chapters drawer toggle */}
            <button
              onClick={() => setShowDrawer(!showDrawer)}
              className={`btn-reader-action ${showDrawer ? 'bookmarked' : ''}`}
              title="Browse all chapters"
            >
              📖 Chapters ({allChapters.length})
            </button>

            {/* Bookmark button */}
            <button
              onClick={handleToggleBookmark}
              className={`btn-reader-action ${isBookmarked ? 'bookmarked' : ''}`}
              title={isBookmarked ? 'Bookmarked' : 'Add Bookmark'}
            >
              {isBookmarked ? '🔖 Saved' : '📑 Bookmark'}
            </button>

            {/* Appearance toggles */}
            <div className="reader-appearance-toggles">
              <button
                className={`btn-pill-small ${fontSize === 'small' ? 'active' : ''}`}
                onClick={() => setFontSize('small')}
                title="Small text"
              >
                A-
              </button>
              <button
                className={`btn-pill-small ${fontSize === 'medium' ? 'active' : ''}`}
                onClick={() => setFontSize('medium')}
                title="Standard text"
              >
                A
              </button>
              <button
                className={`btn-pill-small ${fontSize === 'large' ? 'active' : ''}`}
                onClick={() => setFontSize('large')}
                title="Large text"
              >
                A+
              </button>

              <button
                className={`btn-pill-small ${themeMode === 'dark' ? 'active' : ''}`}
                onClick={() => setThemeMode('dark')}
                title="Charcoal theme"
              >
                🌑
              </button>
              <button
                className={`btn-pill-small ${themeMode === 'sepia' ? 'active' : ''}`}
                onClick={() => setThemeMode('sepia')}
                title="Espresso Parchment theme"
              >
                📜
              </button>
              <button
                className={`btn-pill-small ${themeMode === 'black' ? 'active' : ''}`}
                onClick={() => setThemeMode('black')}
                title="Pitch Black theme"
              >
                ⬛
              </button>
            </div>
          </div>
        </div>

        {bookmarkMsg && <div className="bookmark-toast">{bookmarkMsg}</div>}
      </header>

      {/* Floating / Slide-out Chapter Drawer for Quick Navigation anywhere */}
      {showDrawer && (
        <div className="reader-drawer-overlay" onClick={() => setShowDrawer(false)}>
          <aside
            className="reader-drawer-panel"
            onClick={(e) => e.stopPropagation()}
            aria-label="Chapter Table of Contents"
          >
            <div className="reader-drawer-header">
              <div>
                <span className="drawer-book-title">{bookTitle}</span>
                <h3 className="drawer-heading">Chapters ({allChapters.length})</h3>
              </div>
              <button
                className="btn-text btn-drawer-close"
                onClick={() => setShowDrawer(false)}
                title="Close Chapter Menu"
              >
                ✕
              </button>
            </div>

            <div className="reader-drawer-list">
              {allChapters.map((ch) => {
                const isActive = ch.id === parseInt(chapterId, 10);
                return (
                  <Link
                    key={ch.id}
                    to={`/books/${bookId}/read/${ch.id}`}
                    onClick={() => setShowDrawer(false)}
                    className={`reader-drawer-item ${isActive ? 'active' : ''}`}
                  >
                    <span className="chapter-check-indicator">
                      {isActive ? '✓' : ' '}
                    </span>
                    <span className="chapter-item-text">
                      Chapter {ch.chapter_number} — {ch.title}
                    </span>
                  </Link>
                );
              })}
            </div>
          </aside>
        </div>
      )}

      {/* Main Prose Content */}
      <main className="reader-main">
        <article className={`reader-manuscript font-size-${fontSize}`}>
          <header className="manuscript-header">
            <span className="manuscript-chapter-kicker">
              {bookTitle.toUpperCase()}
            </span>
            <h1 className="manuscript-title">{chapter.title}</h1>
            <div className="manuscript-divider">❧ ❧ ❧</div>
          </header>

          {/* Quick Chapter Navigation Section (Preferred Design) */}
          <section className="reader-quick-nav-panel">
            <div
              className="quick-nav-header-bar"
              onClick={() => setShowChapterNav(!showChapterNav)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  setShowChapterNav(!showChapterNav);
                }
              }}
            >
              <div className="quick-nav-titles">
                <span className="quick-nav-sub">Table of Contents</span>
                <h3 className="quick-nav-title">Chapters</h3>
              </div>
              <button
                type="button"
                className="btn-text btn-toggle-chapters"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowChapterNav(!showChapterNav);
                }}
                aria-expanded={showChapterNav}
              >
                {showChapterNav ? 'Hide List ▲' : `Show All (${allChapters.length}) ▼`}
              </button>
            </div>

            {showChapterNav && (
              <div className="quick-nav-chapters-box">
                {allChapters.map((ch) => {
                  const isActive = ch.id === parseInt(chapterId, 10);
                  return (
                    <Link
                      key={ch.id}
                      to={`/books/${bookId}/read/${ch.id}`}
                      className={`quick-nav-chapter-row ${isActive ? 'active' : ''}`}
                    >
                      <span className="quick-nav-check">
                        {isActive ? '✓' : ' '}
                      </span>
                      <span className="quick-nav-chapter-title">
                        Chapter {ch.chapter_number} — {ch.title}
                      </span>
                    </Link>
                  );
                })}
              </div>
            )}
          </section>

          <div className="manuscript-divider" style={{ margin: '2rem 0 3rem' }}>
            ❧ ❧ ❧
          </div>

          <div className="manuscript-body">
            {chapter.content.split('\n\n').map((paragraph, idx) => (
              <p key={idx}>{paragraph}</p>
            ))}
          </div>

          <footer className="manuscript-footer">
            <div className="manuscript-divider">❧ End of Chapter {chapter.chapter_number} ❧</div>
          </footer>
        </article>

        {/* Chapter Navigation Pagination (Previous / Next with disabled states) */}
        <nav className="reader-pagination-nav">
          <div className="pagination-container">
            {/* Previous Chapter Button */}
            {prevChapter ? (
              <Link
                to={`/books/${bookId}/read/${prevChapter.id}`}
                className="btn-pagination btn-prev"
                title={`Go to Chapter ${prevChapter.chapter_number}: ${prevChapter.title}`}
              >
                <span className="pagination-arrow">←</span>
                <div>
                  <span className="pagination-sub">Previous Chapter</span>
                  <span className="pagination-title">
                    Ch. {prevChapter.chapter_number}: {prevChapter.title}
                  </span>
                </div>
              </Link>
            ) : (
              <button
                className="btn-pagination btn-disabled"
                disabled
                aria-disabled="true"
                title="This is the first chapter"
              >
                <span className="pagination-arrow">←</span>
                <div>
                  <span className="pagination-sub">Previous Chapter</span>
                  <span className="pagination-title">First Chapter</span>
                </div>
              </button>
            )}

            {/* Middle Quick Navigation Button */}
            <button
              type="button"
              onClick={() => {
                setShowChapterNav(true);
                window.scrollTo({ top: 300, behavior: 'smooth' });
              }}
              className="btn-outline btn-toc-jump"
              title="Jump to Table of Chapters"
            >
              All Chapters ({allChapters.length})
            </button>

            {/* Next Chapter Button */}
            {nextChapter ? (
              <Link
                to={`/books/${bookId}/read/${nextChapter.id}`}
                className="btn-pagination btn-next"
                title={`Go to Chapter ${nextChapter.chapter_number}: ${nextChapter.title}`}
              >
                <div style={{ textAlign: 'right' }}>
                  <span className="pagination-sub">Next Chapter</span>
                  <span className="pagination-title">
                    Ch. {nextChapter.chapter_number}: {nextChapter.title}
                  </span>
                </div>
                <span className="pagination-arrow">→</span>
              </Link>
            ) : (
              <button
                className="btn-pagination btn-disabled"
                disabled
                aria-disabled="true"
                title="This is the final chapter"
              >
                <div style={{ textAlign: 'right' }}>
                  <span className="pagination-sub">Next Chapter</span>
                  <span className="pagination-title">End of Releases</span>
                </div>
                <span className="pagination-arrow">→</span>
              </button>
            )}
          </div>
        </nav>
      </main>
    </div>
  );
};

export default Reader;
