import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useSessionContext } from '../context/SessionContext';
import { computeScoreForSessions, computeStreak } from '../lib/scoring';
import { getOptimalWindow } from '../lib/patterns';
import FocusScore from '../components/home/FocusScore';
import StreakCard from '../components/home/StreakCard';
import TomorrowWindow from '../components/home/TomorrowWindow';
import StartSessionModal from '../components/home/StartSessionModal';

const pageVariants = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -10 },
};

interface ActiveSession {
  goal: string;
  plannedDuration: number;
  startedAt: number;
}

function formatElapsed(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const pad = (n: number) => n.toString().padStart(2, '0');

  if (h > 0) {
    return `${pad(h)}:${pad(m)}:${pad(s)}`;
  }
  return `${pad(m)}:${pad(s)}`;
}

export default function Home() {
  const { sessions, loading, extensionConnected, refresh } = useSessionContext();
  const [showModal, setShowModal] = useState(false);
  const [activeSession, setActiveSession] = useState<ActiveSession | null>(null);
  const [elapsed, setElapsed] = useState(0);

  // Check for active session on mount
  const checkActiveSession = useCallback(() => {
    const stored = localStorage.getItem('flowos_active_session');
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as ActiveSession;
        setActiveSession(parsed);
      } catch {
        setActiveSession(null);
      }
    } else {
      setActiveSession(null);
    }
  }, []);

  useEffect(() => {
    checkActiveSession();

    // Listen for session start events from the modal
    const handler = () => checkActiveSession();
    window.addEventListener('flowos-session-started', handler);
    return () => window.removeEventListener('flowos-session-started', handler);
  }, [checkActiveSession]);

  // Live timer for active session
  useEffect(() => {
    if (!activeSession) return;

    const updateElapsed = () => {
      const now = Date.now();
      const diff = Math.floor((now - activeSession.startedAt) / 1000);
      setElapsed(diff);
    };

    updateElapsed();
    const interval = setInterval(updateElapsed, 1000);
    return () => clearInterval(interval);
  }, [activeSession]);

  const endSession = () => {
    localStorage.removeItem('flowos_active_session');
    setActiveSession(null);
    setElapsed(0);
    refresh();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="text-flow-muted text-sm font-mono animate-pulse">
          Loading sessions...
        </div>
      </div>
    );
  }

  const hour = new Date().getHours();
  const greeting =
    hour < 12
      ? 'Good morning.'
      : hour < 17
      ? 'Good afternoon.'
      : 'Good evening.';

  // ─── Has sessions (real or mock) — show dashboard ──────
  const score = computeScoreForSessions(sessions.slice(0, 3));
  const streak = computeStreak(sessions);
  const optimalWindow = getOptimalWindow(sessions);

  const lastSession = sessions.length > 0
    ? sessions.reduce((a, b) => (a.startTime > b.startTime ? a : b))
    : null;
  const lastFocusMin = lastSession ? Math.round(lastSession.stats.realFocusTime / 60000) : 0;
  const lastRatio = lastSession ? Math.round(lastSession.stats.focusRatio * 100) : 0;

  return (
    <motion.div
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={{ duration: 0.3 }}
      className="space-y-8"
    >
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-white">
          {greeting}{' '}
          <span className="text-flow-muted font-normal">
            Time to do real work.
          </span>
        </h2>
        <p className="text-xs text-flow-very-muted font-mono mt-1">
          {new Date().toLocaleDateString('en-US', {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
            year: 'numeric',
          })}
        </p>
      </div>

      {/* Top Section: Score + Streak */}
      {sessions.length > 0 && (
        <div className="grid grid-cols-[auto_1fr] gap-8 items-start">
          <FocusScore score={score} />

          <div className="space-y-3 pt-2">
            <StreakCard streak={streak} />

            {/* Last Session Quick Summary */}
            {lastSession && (
              <motion.div
                className="card-dashed px-5 py-4"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
              >
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[10px] font-mono uppercase tracking-widest text-flow-muted">
                    Last Session
                  </p>
                  <span
                    className="text-[10px] font-mono px-2 py-0.5 rounded-full"
                    style={{
                      backgroundColor:
                        lastRatio > 60
                          ? 'rgba(0,212,106,0.15)'
                          : lastRatio > 40
                          ? 'rgba(255,107,53,0.15)'
                          : 'rgba(255,59,59,0.15)',
                      color:
                        lastRatio > 60
                          ? '#00D46A'
                          : lastRatio > 40
                          ? '#FF6B35'
                          : '#FF3B3B',
                    }}
                  >
                    {lastRatio}% focused
                  </span>
                </div>
                <p className="text-sm text-white">{lastSession.goal}</p>
                <p className="text-xs text-flow-muted mt-1">
                  <span className="font-mono">{lastFocusMin}</span> min focused out
                  of <span className="font-mono">{lastSession.plannedDuration}</span>{' '}
                  min planned
                </p>
              </motion.div>
            )}
          </div>
        </div>
      )}

      {/* Active Session Timer OR Start Session CTA */}
      {activeSession ? (
        <motion.div
          className="card-dashed px-6 py-5 space-y-3"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45 }}
        >
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-flow-green animate-pulse" />
            <span className="text-xs font-mono text-flow-green">SESSION ACTIVE</span>
          </div>
          <p className="text-sm text-flow-muted">{activeSession.goal}</p>
          <p className="text-4xl font-mono text-white">{formatElapsed(elapsed)}</p>
          <p className="text-xs text-flow-very-muted font-mono">
            of {activeSession.plannedDuration} min planned
          </p>
          <button
            onClick={endSession}
            className="text-xs font-mono text-flow-red border border-dashed border-flow-red/40 rounded px-4 py-2 hover:bg-flow-red/5 transition-colors"
          >
            End Session
          </button>
        </motion.div>
      ) : (
        <motion.div
          className="card-dashed px-6 py-6 text-center"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45 }}
        >
          <p className="text-xs font-mono uppercase tracking-widest text-flow-muted mb-3">
            Ready for another session?
          </p>
          <p className="text-sm text-flow-muted mb-4">
            Set a goal, choose your duration, and begin.
          </p>
          <button
            onClick={() => setShowModal(true)}
            className="bg-flow-cyan text-flow-bg font-bold px-6 py-3 rounded-lg text-sm hover:shadow-glow-cyan transition-all hover:-translate-y-0.5 active:translate-y-0"
          >
            START FOCUS SESSION →
          </button>
        </motion.div>
      )}

      {/* Tomorrow's Window */}
      {sessions.length > 0 && <TomorrowWindow window={optimalWindow} />}

      {/* Demo Mode Banner */}
      {!extensionConnected && (
        <div className="card-dashed px-4 py-3 flex items-center justify-between">
          <span className="text-[10px] font-mono text-flow-very-muted">
            ○ DEMO MODE — data shown is simulated. Install the extension to track real sessions.
          </span>
          <a
            href="https://developer.chrome.com/docs/extensions/mv3/getstarted/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[10px] font-mono text-flow-cyan hover:underline ml-4 whitespace-nowrap"
          >
            Setup →
          </a>
        </div>
      )}

      {/* Start Session Modal */}
      <StartSessionModal isOpen={showModal} onClose={() => setShowModal(false)} />
    </motion.div>
  );
}
