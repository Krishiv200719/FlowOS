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

function AppRoutes() {
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
        <Routes>
          <Route path="/home"              element={<Home key="home" />} />
          <Route path="/mirror"            element={<Mirror key="mirror" />} />
          <Route path="/mirror/:sessionId" element={<Mirror key="mirror-detail" />} />
          <Route path="/dna"               element={<DNA key="dna" />} />
          <Route path="/history"           element={<History key="history" />} />
          <Route path="/activity"          element={<Activity key="activity" />} />
          {/* Any unknown path in app → home */}
          <Route path="*"                  element={<Navigate to="/home" replace />} />
        </Routes>
      </AnimatePresence>
    </AppShell>
  );
}

export default function App() {
  return (
    <Routes>
      {/* Landing page at root — first thing visitors see */}
      <Route path="/" element={<Landing />} />

      {/* Dashboard — wrapped in SessionProvider */}
      <Route path="/home"              element={<SessionProvider><AppRoutes /></SessionProvider>} />
      <Route path="/mirror/*"          element={<SessionProvider><AppRoutes /></SessionProvider>} />
      <Route path="/dna"               element={<SessionProvider><AppRoutes /></SessionProvider>} />
      <Route path="/history"           element={<SessionProvider><AppRoutes /></SessionProvider>} />
      <Route path="/activity"          element={<SessionProvider><AppRoutes /></SessionProvider>} />

      {/* Catch-all → landing */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
