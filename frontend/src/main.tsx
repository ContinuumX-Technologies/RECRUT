import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import './index.css';
import { CandidateInterviewPage } from './pages/CandidateInterviewPage';
import { AdminInterviewPage } from './pages/AdminInterviewPage';
import { AdminDashboardPage } from './pages/AdminDashboardPage';
import { CandidateDashboardPage } from './pages/CandidateDashboardPage';
import { AuthProvider } from './context/AuthContext';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { useAuth } from './context/AuthContext';
import  LandingPage  from "./pages/LandingPage";

const queryClient = new QueryClient();

function RequireRole({ role, children }: { role: 'CANDIDATE' | 'INTERVIEWER'; children: React.ReactNode }) {
  const { user } = useAuth();
  if (!user) return <LoginPage />;
  if (user.role !== role) return <div className="p-4 text-red-400">Access denied</div>;
  return children;
}
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AuthProvider>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route
              path="/candidate/dashboard"
              element={
                <RequireRole role="CANDIDATE">
                  <CandidateDashboardPage />
                </RequireRole>
              }
            />
            <Route
              path="/interviewer/dashboard"
              element={
                <RequireRole role="INTERVIEWER">
                  <AdminDashboardPage />
                </RequireRole>
              }
            />
            <Route path="/interview/:id" element={<CandidateInterviewPage />} />
            <Route path="/admin/interview/:id" element={<AdminInterviewPage />} />
            <Route path="/candidate/:candidateId" element={<CandidateDashboardPage />} />
            <Route path="*" element={<div>Not found</div>} />
          </Routes>
        </BrowserRouter>
      </QueryClientProvider>
    </AuthProvider>
  </React.StrictMode>
);
