import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Loading from './Loading';

const ProtectedRoute = ({ children, authorOnly = false }) => {
  const { user, isAuthenticated, loading, isAuthor } = useAuth();
  const location = useLocation();

  if (loading) {
    return <Loading message="Checking authorization..." />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (authorOnly && !isAuthor) {
    return <Navigate to="/library" replace />;
  }

  return children;
};

export default ProtectedRoute;
