import { useEffect, useRef } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { SessionProvider, useSessionContext } from './context/SessionContext';
import AppShell from './components/layout/AppShell';
import Home from './screens/Home';
import Mirror from './screens/Mirror';
import DNA from './screens/DNA';
import History from './screens/History';
import Activity from './screens/Activity';
import Landing from './landing/Landing';

// Wraps every dashboard screen: adds sidebar, animations, and session auto-redirect
function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { sessions } = useSessionContext();
  const navigate = useNavigate();
  const prevLengthRef = useRef(sessions.length);

  useEffect(() => {
    if (sessions.length > prevLengthRef.current && sessions[0]) {
      navigate(`/mirror/${sessions[0].id}`);
    }
    prevLengthRef.current = sessions.length;
  }, [sessions.length, sessions, navigate]);

  return (
    <AppShell>
      <AnimatePresence mode="wait">
        {children}
      </AnimatePresence>
    </AppShell>
  );
}

export default function App() {
  return (
    // SessionProvider wraps everything — lightweight, no harm on landing page
    <SessionProvider>
      <Routes>
        {/* Landing — root exact match, never matches /home or /mirror etc */}
        <Route path="/" element={<Landing />} />

        {/* Dashboard screens — each route renders DashboardLayout + its screen */}
        <Route path="/home"              element={<DashboardLayout><Home key="home" /></DashboardLayout>} />
        <Route path="/mirror"            element={<DashboardLayout><Mirror key="mirror" /></DashboardLayout>} />
        <Route path="/mirror/:sessionId" element={<DashboardLayout><Mirror key="mirror-detail" /></DashboardLayout>} />
        <Route path="/dna"               element={<DashboardLayout><DNA key="dna" /></DashboardLayout>} />
        <Route path="/history"           element={<DashboardLayout><History key="history" /></DashboardLayout>} />
        <Route path="/activity"          element={<DashboardLayout><Activity key="activity" /></DashboardLayout>} />

        {/* Anything else → landing */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </SessionProvider>
  );
}
