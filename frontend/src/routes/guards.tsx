import * as React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth, homePathFor } from '@/features/auth/AuthContext';
import type { Role } from '@/types';
import { FullPageLoader } from './FullPageLoader';

/**
 * Gate for authenticated routes.
 *
 * Redirects to /masuk when anonymous, and to the user's own home when they
 * try to reach a route for the other role. This is a UX convenience only -
 * the backend enforces authorization independently on every endpoint.
 */
export function ProtectedRoute({
  children,
  roles,
}: {
  children: React.ReactNode;
  roles?: Role[];
}) {
  const { user, status } = useAuth();
  const location = useLocation();

  if (status === 'loading') return <FullPageLoader />;

  if (status === 'anonymous' || !user) {
    return <Navigate to="/masuk" replace state={{ from: location.pathname + location.search }} />;
  }

  if (roles && !roles.includes(user.role)) {
    // Wrong role: send them to their own dashboard rather than a dead end.
    return <Navigate to={homePathFor(user.role)} replace />;
  }

  return <>{children}</>;
}

/** Keeps signed-in users out of the auth screens. */
export function PublicOnlyRoute({ children }: { children: React.ReactNode }) {
  const { user, status } = useAuth();

  if (status === 'loading') return <FullPageLoader />;
  if (user) return <Navigate to={homePathFor(user.role)} replace />;

  return <>{children}</>;
}
