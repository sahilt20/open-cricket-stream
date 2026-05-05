import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext.js';
import { EngineProvider } from './contexts/EngineContext.js';
import { ProtectedRoute } from './components/ProtectedRoute.js';

import { HomePage } from './pages/HomePage.js';
import { SignInPage } from './pages/SignInPage.js';
import { SignUpPage } from './pages/SignUpPage.js';
import { OnboardingPage } from './pages/OnboardingPage.js';
import { ScorerPage } from './pages/ScorerPage.js';
import { AdminPage } from './pages/AdminPage.js';
import { AdminTeamsPage } from './pages/AdminTeamsPage.js';
import { AdminPlayersPage } from './pages/AdminPlayersPage.js';
import { NotFoundPage } from './pages/NotFoundPage.js';

export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <EngineProvider>
          <Routes>
            {/* Public */}
            <Route path="/auth/signin" element={<SignInPage />} />
            <Route path="/auth/signup" element={<SignUpPage />} />

            {/* Needs auth, no club yet */}
            <Route
              path="/onboarding"
              element={
                <ProtectedRoute>
                  <OnboardingPage />
                </ProtectedRoute>
              }
            />

            {/* Scorer (scorer role + club) */}
            <Route
              path="/scorer"
              element={
                <ProtectedRoute minRole="scorer" requireClub>
                  <ScorerPage />
                </ProtectedRoute>
              }
            />

            {/* Admin (club_admin role + club) */}
            <Route
              path="/admin"
              element={
                <ProtectedRoute minRole="club_admin" requireClub>
                  <AdminPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/teams"
              element={
                <ProtectedRoute minRole="club_admin" requireClub>
                  <AdminTeamsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/players"
              element={
                <ProtectedRoute minRole="club_admin" requireClub>
                  <AdminPlayersPage />
                </ProtectedRoute>
              }
            />

            {/* Home — auth-aware redirect */}
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <HomePage />
                </ProtectedRoute>
              }
            />

            {/* 404 */}
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </EngineProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
