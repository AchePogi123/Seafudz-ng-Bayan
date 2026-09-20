import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { getActiveUser, getStoredSessionToken, ROLE_DEFAULT_ROUTES, buildTokenizedUrl } from '../cryptography/cryptoSession';

interface ProtectedRouteProps {
  allowedRoles: string[];
  children: React.ReactElement;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ allowedRoles, children }) => {
  const location = useLocation();
  const activeUser = getActiveUser();
  const sessionToken = getStoredSessionToken();

  // If no user profile or session exists, redirect to /login
  if (!activeUser && !sessionToken) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  const userRole = (activeUser?.role || 'customer').toLowerCase();
  const isAdmin = userRole === 'admin';

  // Admin has universal bypass access to all routes
  if (isAdmin || allowedRoles.map(r => r.toLowerCase()).includes(userRole)) {
    return children;
  }

  // User is logged in but role is NOT allowed for this route
  const fallbackRoute = ROLE_DEFAULT_ROUTES[userRole] || '/customer';
  const tokenizedFallback = buildTokenizedUrl(fallbackRoute, sessionToken || '');

  console.warn(`[RBAC Access Denied] Role '${userRole}' is not authorized to visit ${location.pathname}. Redirecting to ${fallbackRoute}`);

  return <Navigate to={tokenizedFallback} replace />;
};

export default ProtectedRoute;
