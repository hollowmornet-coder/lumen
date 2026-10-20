import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { AuthProvider } from '@/features/auth/AuthContext';
import { ThemeProvider } from '@/providers/ThemeProvider';
import { AppShell } from '@/layouts/AppShell';
import { ProtectedRoute, PublicOnlyRoute } from '@/routes/guards';
import { FullPageLoader } from '@/routes/FullPageLoader';
import { ErrorBoundary } from '@/routes/ErrorBoundary';
import { ApiError } from '@/lib/api';

import { LoginPage } from '@/pages/LoginPage';
import { RegisterPage } from '@/pages/RegisterPage';
import { NotFoundPage } from '@/pages/NotFoundPage';
import ForbiddenPage from '@/pages/ForbiddenPage';

// Route-level code splitting keeps the first paint small.
const AdminDashboardPage = lazy(() => import('@/pages/admin/AdminDashboardPage'));
const AdminLoansPage = lazy(() => import('@/pages/admin/AdminLoansPage'));
const AdminCirculationPage = lazy(() => import('@/pages/admin/AdminCirculationPage'));
const AdminFinesPage = lazy(() => import('@/pages/admin/AdminFinesPage'));
const AdminBooksPage = lazy(() => import('@/pages/admin/AdminBooksPage'));
const AdminMembersPage = lazy(() => import('@/pages/admin/AdminMembersPage'));
const AdminReportsPage = lazy(() => import('@/pages/admin/AdminReportsPage'));
const AdminActivityPage = lazy(() => import('@/pages/admin/AdminActivityPage'));
const AdminSettingsPage = lazy(() => import('@/pages/admin/AdminSettingsPage'));
const AdminHolidaysPage = lazy(() => import('@/pages/admin/AdminHolidaysPage'));
const AdminVisitsPage = lazy(() => import('@/pages/admin/AdminVisitsPage'));
const AdminOpnamePage = lazy(() => import('@/pages/admin/AdminOpnamePage'));
const AdminAnnouncementsPage = lazy(() => import('@/pages/admin/AdminAnnouncementsPage'));

const MemberHomePage = lazy(() => import('@/pages/member/MemberHomePage'));
const MyLoansPage = lazy(() => import('@/pages/member/MyLoansPage'));
const MyHistoryPage = lazy(() => import('@/pages/member/MyHistoryPage'));
const MyFinesPage = lazy(() => import('@/pages/member/MyFinesPage'));
const MyReservationsPage = lazy(() => import('@/pages/member/MyReservationsPage'));
const MyWishlistPage = lazy(() => import('@/pages/member/MyWishlistPage'));
const ProfilePage = lazy(() => import('@/pages/member/ProfilePage'));

const CatalogPage = lazy(() => import('@/pages/CatalogPage'));
const BookDetailPage = lazy(() => import('@/pages/BookDetailPage'));
const AuthorCollectionPage = lazy(() => import('@/pages/AuthorCollectionPage'));
const SeriesDetailPage = lazy(() => import('@/pages/SeriesDetailPage'));
const SeriesCatalogPage = lazy(() => import('@/pages/SeriesCatalogPage'));

const ForgotPasswordPage = lazy(() => import('@/pages/ForgotPasswordPage'));

/** Wraps a protected area with the app shell. */
function Shell({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}

/**
 * Created once, outside the component, so every re-render reuses the same
 * cache instead of throwing away all server data.
 */
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // A school LAN is fast; refetching constantly is just noise.
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      retry: (failureCount, error) => {
        // Never retry auth/permission failures - they will not fix themselves.
        if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
          return false;
        }
        return failureCount < 2;
      },
    },
    mutations: {
      retry: false,
    },
  },
});

export default function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <ThemeProvider>
          <AuthProvider>
          <Suspense fallback={<FullPageLoader />}>
            <Routes>
              {/* ---------- Public ---------- */}
              <Route
                path="/masuk"
                element={
                  <PublicOnlyRoute>
                    <LoginPage />
                  </PublicOnlyRoute>
                }
              />
              <Route
                path="/daftar"
                element={
                  <PublicOnlyRoute>
                    <RegisterPage />
                  </PublicOnlyRoute>
                }
              />
              <Route path="/lupa-sandi" element={<ForgotPasswordPage />} />
              <Route path="/reset-sandi" element={<ForgotPasswordPage />} />

              {/* ---------- Admin ---------- */}
              <Route
                path="/admin"
                element={
                  <ProtectedRoute roles={['admin']}>
                    <Shell>
                      <AdminDashboardPage />
                    </Shell>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/transaksi"
                element={
                  <ProtectedRoute roles={['admin']}>
                    <Shell>
                      <AdminLoansPage />
                    </Shell>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/sirkulasi"
                element={
                  <ProtectedRoute roles={['admin']}>
                    <Shell>
                      <AdminCirculationPage />
                    </Shell>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/denda"
                element={
                  <ProtectedRoute roles={['admin']}>
                    <Shell>
                      <AdminFinesPage />
                    </Shell>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/buku"
                element={
                  <ProtectedRoute roles={['admin']}>
                    <Shell>
                      <AdminBooksPage />
                    </Shell>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/anggota"
                element={
                  <ProtectedRoute roles={['admin']}>
                    <Shell>
                      <AdminMembersPage />
                    </Shell>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/laporan"
                element={
                  <ProtectedRoute roles={['admin']}>
                    <Shell>
                      <AdminReportsPage />
                    </Shell>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/aktivitas"
                element={
                  <ProtectedRoute roles={['admin']}>
                    <Shell>
                      <AdminActivityPage />
                    </Shell>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/pengaturan"
                element={
                  <ProtectedRoute roles={['admin']}>
                    <Shell>
                      <AdminSettingsPage />
                    </Shell>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/hari-libur"
                element={
                  <ProtectedRoute roles={['admin']}>
                    <Shell>
                      <AdminHolidaysPage />
                    </Shell>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/kunjungan"
                element={
                  <ProtectedRoute roles={['admin']}>
                    <Shell>
                      <AdminVisitsPage />
                    </Shell>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/opname"
                element={
                  <ProtectedRoute roles={['admin']}>
                    <Shell>
                      <AdminOpnamePage />
                    </Shell>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/pengumuman"
                element={
                  <ProtectedRoute roles={['admin']}>
                    <Shell>
                      <AdminAnnouncementsPage />
                    </Shell>
                  </ProtectedRoute>
                }
              />

              {/* ---------- Member ---------- */}
              <Route
                path="/perpustakaan"
                element={
                  <ProtectedRoute>
                    <Shell>
                      <MemberHomePage />
                    </Shell>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/perpustakaan/pinjaman"
                element={
                  <ProtectedRoute>
                    <Shell>
                      <MyLoansPage />
                    </Shell>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/perpustakaan/riwayat"
                element={
                  <ProtectedRoute>
                    <Shell>
                      <MyHistoryPage />
                    </Shell>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/perpustakaan/denda"
                element={
                  <ProtectedRoute>
                    <Shell>
                      <MyFinesPage />
                    </Shell>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/perpustakaan/reservasi"
                element={
                  <ProtectedRoute>
                    <Shell>
                      <MyReservationsPage />
                    </Shell>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/perpustakaan/daftar-keinginan"
                element={
                  <ProtectedRoute>
                    <Shell>
                      <MyWishlistPage />
                    </Shell>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/perpustakaan/profil"
                element={
                  <ProtectedRoute>
                    <Shell>
                      <ProfilePage />
                    </Shell>
                  </ProtectedRoute>
                }
              />

              {/* ---------- Shared ---------- */}
              <Route
                path="/katalog"
                element={
                  <ProtectedRoute>
                    <Shell>
                      <CatalogPage />
                    </Shell>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/katalog/seri"
                element={
                  <ProtectedRoute>
                    <Shell>
                      <SeriesCatalogPage />
                    </Shell>
                  </ProtectedRoute>
                }
              />
              {/* Author collections: catalog -> author -> series -> book. */}
              <Route
                path="/katalog/penulis/:slug"
                element={
                  <ProtectedRoute>
                    <Shell>
                      <AuthorCollectionPage />
                    </Shell>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/katalog/seri/:id"
                element={
                  <ProtectedRoute>
                    <Shell>
                      <SeriesDetailPage />
                    </Shell>
                  </ProtectedRoute>
                }
              />
              {/* The sidebar links here; keep it working as an alias. */}
              <Route
                path="/perpustakaan/katalog"
                element={
                  <ProtectedRoute>
                    <Navigate to="/katalog" replace />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/katalog/:id"
                element={
                  <ProtectedRoute>
                    <Shell>
                      <BookDetailPage />
                    </Shell>
                  </ProtectedRoute>
                }
              />

              {/* ---------- Errors ---------- */}
              <Route
                path="/403"
                element={
                  <Shell>
                    <ForbiddenPage />
                  </Shell>
                }
              />
              <Route
                path="*"
                element={
                  <Shell>
                    <NotFoundPage />
                  </Shell>
                }
              />
              <Route path="/" element={<Navigate to="/masuk" replace />} />
            </Routes>
          </Suspense>

          <Toaster
            position="top-right"
            richColors
            closeButton
            duration={4000}
            toastOptions={{
              classNames: {
                toast: 'rounded-xl border border-border shadow-lift',
              },
            }}
          />
          </AuthProvider>
          </ThemeProvider>
        </BrowserRouter>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
