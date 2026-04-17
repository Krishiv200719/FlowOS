import { motion } from 'framer-motion';
import { useSessionContext } from '../context/SessionContext';
import { computeScoreForSessions, computeStreak } from '../lib/scoring';
import { getOptimalWindow } from '../lib/patterns';
import FocusScore from '../components/home/FocusScore';
import StreakCard from '../components/home/StreakCard';
import TomorrowWindow from '../components/home/TomorrowWindow';

const pageVariants = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -10 },
};

export default function Home() {
  const { sessions, loading, extensionConnected } = useSessionContext();

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

  // ─── No Extension ──────────────────────────────────────
  if (!extensionConnected) {
    return (
      <motion.div
        variants={pageVariants}
        initial="initial"
        animate="animate"
        exit="exit"
        transition={{ duration: 0.3 }}
        className="space-y-8"
      >
        <div>
          <h2 className="text-2xl font-bold text-white">
            {greeting}{' '}
            <span className="text-flow-muted font-normal">
              Let's get set up.
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

        <motion.div
          className="card-dashed px-8 py-10 text-center space-y-5"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <span className="text-5xl">🔌</span>
          <p className="text-lg font-bold text-white">
            Connect the FlowOS Extension
          </p>
          <p className="text-sm text-flow-muted max-w-md mx-auto leading-relaxed">
            Your dashboard will display real data from your focus sessions.
            No hardcoded or demo data — everything you see is yours.
          </p>
          <div className="bg-flow-elevated rounded-lg px-5 py-4 inline-block text-left">
            <p className="text-[11px] text-flow-very-muted font-mono leading-relaxed">
              1. Open <span className="text-flow-cyan">chrome://extensions</span><br />
              2. Enable <span className="text-flow-cyan">Developer mode</span> (top right)<br />
              3. Click <span className="text-flow-cyan">Load unpacked</span><br />
              4. Select the <span className="text-flow-cyan">extension/</span> folder<br />
              5. Reload this page
            </p>
          </div>
        </motion.div>
      </motion.div>
    );
  }

  // ─── Connected but no sessions ─────────────────────────
  if (sessions.length === 0) {
    return (
      <motion.div
        variants={pageVariants}
        initial="initial"
        animate="animate"
        exit="exit"
        transition={{ duration: 0.3 }}
        className="space-y-8"
      >
        <div>
          <h2 className="text-2xl font-bold text-white">
            {greeting}{' '}
            <span className="text-flow-muted font-normal">
              Time to do real work.
            </span>
          </h2>
        </div>

        <motion.div
          className="card-dashed px-8 py-10 text-center space-y-5"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <span className="text-5xl">🚀</span>
          <p className="text-lg font-bold text-white">
            Extension Connected — Start Your First Session
          </p>
          <p className="text-sm text-flow-muted max-w-md mx-auto">
            Click the FlowOS icon in your Chrome toolbar, set a goal, and start
            a focus session. Your data will appear here automatically.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="bg-flow-cyan text-flow-bg font-bold px-6 py-3 rounded-lg text-sm hover:shadow-glow-cyan transition-all hover:-translate-y-0.5 active:translate-y-0"
          >
            ↻ REFRESH DASHBOARD
          </button>
        </motion.div>
      </motion.div>
    );
  }

  // ─── Has sessions — show real data ─────────────────────
  const score = computeScoreForSessions(sessions.slice(0, 3));
  const streak = computeStreak(sessions);
  const optimalWindow = getOptimalWindow(sessions);

  const lastSession = sessions.reduce((a, b) =>
    a.startTime > b.startTime ? a : b
  );
  const lastFocusMin = Math.round(lastSession.stats.realFocusTime / 60000);
  const lastRatio = Math.round(lastSession.stats.focusRatio * 100);

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
      <div className="grid grid-cols-[auto_1fr] gap-8 items-start">
        <FocusScore score={score} />

        <div className="space-y-3 pt-2">
          <StreakCard streak={streak} />

          {/* Last Session Quick Summary */}
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
        </div>
      </div>

      {/* Start New Session */}
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
          Click the FlowOS icon in your toolbar to start a new focus session.
        </p>
        <button
          onClick={() => window.location.reload()}
          className="text-xs font-mono text-flow-cyan border border-dashed border-flow-cyan/30 rounded px-4 py-2 hover:bg-flow-cyan/5 transition-colors"
        >
          ↻ Refresh Data
        </button>
      </motion.div>

      {/* Tomorrow's Window */}
      <TomorrowWindow window={optimalWindow} />
    </motion.div>
  );
}
