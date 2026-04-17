import { useEffect, useRef } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { SessionProvider, useSessionContext } from './context/SessionContext';
import AppShell from './components/layout/AppShell';
import Home from './screens/Home';
import Mirror from './screens/Mirror';
import DNA from './screens/DNA';
import History from './screens/History';

function AppRoutes() {
  const { sessions } = useSessionContext();
  const navigate = useNavigate();
  const prevLengthRef = useRef(sessions.length);

  // Auto-navigate to Mirror when a new session appears
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
          <Route path="/" element={<Home key="home" />} />
          <Route path="/mirror" element={<Mirror key="mirror" />} />
          <Route path="/mirror/:sessionId" element={<Mirror key="mirror-detail" />} />
          <Route path="/dna" element={<DNA key="dna" />} />
          <Route path="/history" element={<History key="history" />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AnimatePresence>
    </AppShell>
  );
}

export default function App() {
  return (
    <SessionProvider>
      <AppRoutes />
    </SessionProvider>
  );
}
