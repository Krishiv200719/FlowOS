import { Routes, Route, Navigate } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { SessionProvider } from './context/SessionContext';
import AppShell from './components/layout/AppShell';
import Home from './screens/Home';
import Mirror from './screens/Mirror';
import DNA from './screens/DNA';
import History from './screens/History';

export default function App() {
  return (
    <SessionProvider>
      <AppShell>
        <AnimatePresence mode="wait">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/mirror" element={<Mirror />} />
            <Route path="/mirror/:sessionId" element={<Mirror />} />
            <Route path="/dna" element={<DNA />} />
            <Route path="/history" element={<History />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AnimatePresence>
      </AppShell>
    </SessionProvider>
  );
}
