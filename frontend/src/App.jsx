import React from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import ProtectedRoute from './components/ProtectedRoute';

// Pages
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import Library from './pages/Library';
import BookDetails from './pages/BookDetails';
import Reader from './pages/Reader';
import Profile from './pages/Profile';
import AuthorDashboard from './pages/AuthorDashboard';
import MyBooks from './pages/MyBooks';
import CreateBook from './pages/CreateBook';
import EditBook from './pages/EditBook';
import CreateChapter from './pages/CreateChapter';
import ManageChapters from './pages/ManageChapters';
import EditChapter from './pages/EditChapter';

function App() {
  const location = useLocation();

  // Hide general navbar and footer during dedicated full-focus reader mode
  const isReaderMode = location.pathname.includes('/read/');

  return (
    <div className="app-shell">
      {!isReaderMode && <Navbar />}

      <main className="app-main-content">
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/library" element={<Library />} />
          <Route path="/books/:id" element={<BookDetails />} />
          <Route path="/books/:id/read/:chapterId" element={<Reader />} />

          {/* Authenticated Reader Routes */}
          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <Profile />
              </ProtectedRoute>
            }
          />

          {/* Authenticated Author / Admin Routes */}
          <Route
            path="/author"
            element={
              <ProtectedRoute authorOnly={true}>
                <AuthorDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/author/dashboard"
            element={
              <ProtectedRoute authorOnly={true}>
                <AuthorDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/author/studio"
            element={
              <ProtectedRoute authorOnly={true}>
                <AuthorDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/author/books"
            element={
              <ProtectedRoute authorOnly={true}>
                <MyBooks />
              </ProtectedRoute>
            }
          />
          <Route
            path="/author/books/create"
            element={
              <ProtectedRoute authorOnly={true}>
                <CreateBook />
              </ProtectedRoute>
            }
          />
          <Route
            path="/author/books/:bookId/edit"
            element={
              <ProtectedRoute authorOnly={true}>
                <EditBook />
              </ProtectedRoute>
            }
          />
          <Route
            path="/author/books/:bookId/chapters"
            element={
              <ProtectedRoute authorOnly={true}>
                <ManageChapters />
              </ProtectedRoute>
            }
          />
          <Route
            path="/author/books/:bookId/chapters/create"
            element={
              <ProtectedRoute authorOnly={true}>
                <CreateChapter />
              </ProtectedRoute>
            }
          />
          <Route
            path="/author/books/:bookId/chapters/:chapterId/edit"
            element={
              <ProtectedRoute authorOnly={true}>
                <EditChapter />
              </ProtectedRoute>
            }
          />

          {/* Catch-all 404 Route */}
          <Route
            path="*"
            element={
              <div className="section-container" style={{ padding: '6rem 1.5rem', textAlign: 'center' }}>
                <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '3rem', marginBottom: '1rem' }}>
                  404 — Page In The Mists
                </h1>
                <p style={{ color: 'var(--color-text-secondary)', marginBottom: '2rem' }}>
                  The parchment or chapter you seek has vanished or has not yet been transcribed.
                </p>
                <a href="/library" className="btn-primary">
                  Return to Library
                </a>
              </div>
            }
          />
        </Routes>
      </main>

      {!isReaderMode && <Footer />}
    </div>
  );
}

export default App;
