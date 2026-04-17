import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useSessionContext } from '../context/SessionContext';

const pageVariants = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -10 },
};

export default function History() {
  const { sessions, loading, extensionConnected } = useSessionContext();
  const navigate = useNavigate();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="text-flow-muted text-sm font-mono animate-pulse">
          Loading sessions...
        </div>
      </div>
    );
  }

  if (!extensionConnected) {
    return (
      <motion.div
        variants={pageVariants}
        initial="initial"
        animate="animate"
        exit="exit"
        className="flex flex-col items-center justify-center h-[60vh] space-y-4"
      >
        <span className="text-4xl">🔌</span>
        <p className="text-lg font-medium text-white">Extension Not Connected</p>
        <p className="text-sm text-flow-muted">
          Install the FlowOS extension to see your session history.
        </p>
      </motion.div>
    );
  }

  const sorted = [...sessions].sort((a, b) => b.startTime - a.startTime);

  if (sorted.length === 0) {
    return (
      <motion.div
        variants={pageVariants}
        initial="initial"
        animate="animate"
        exit="exit"
        className="flex flex-col items-center justify-center h-[60vh] space-y-4"
      >
        <span className="text-4xl">📋</span>
        <p className="text-lg font-medium text-white">No sessions yet</p>
        <p className="text-sm text-flow-muted">
          Complete a focus session using the Chrome extension.
        </p>
        <button
          onClick={() => window.location.reload()}
          className="text-xs font-mono text-flow-cyan border border-dashed border-flow-cyan/30 rounded px-4 py-2 hover:bg-flow-cyan/5 transition-colors mt-2"
        >
          ↻ Refresh
        </button>
      </motion.div>
    );
  }

  return (
    <motion.div
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={{ duration: 0.3 }}
      className="space-y-6"
    >
      <div>
        <h2 className="text-2xl font-bold text-white">Session History</h2>
        <p className="text-sm text-flow-muted mt-1">
          <span className="font-mono text-flow-cyan">{sorted.length}</span>{' '}
          sessions recorded
        </p>
      </div>

      <div className="space-y-2">
        {sorted.map((session, i) => {
          const focusPct = Math.round(session.stats.focusRatio * 100);
          const focusMin = Math.round(session.stats.realFocusTime / 60000);
          const pctColor =
            focusPct > 60
              ? '#00D46A'
              : focusPct > 40
              ? '#FF6B35'
              : '#FF3B3B';
          const pctBg =
            focusPct > 60
              ? 'rgba(0,212,106,0.12)'
              : focusPct > 40
              ? 'rgba(255,107,53,0.12)'
              : 'rgba(255,59,59,0.12)';

          const date = new Date(session.startTime);
          const now = new Date();
          const diffDays = Math.floor(
            (now.getTime() - date.getTime()) / 86400000
          );

          let dateStr: string;
          if (diffDays === 0) dateStr = 'Today';
          else if (diffDays === 1) dateStr = 'Yesterday';
          else
            dateStr = date.toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
            });

          const timeStr = date.toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
          });

          return (
            <motion.div
              key={session.id}
              className="card-dashed px-5 py-4 cursor-pointer hover:bg-flow-elevated hover:border-flow-muted/30 transition-all duration-200 group"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              onClick={() => navigate(`/mirror/${session.id}`)}
            >
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-1">
                    <span className="text-sm text-flow-muted font-mono">
                      {dateStr}, {timeStr}
                    </span>
                    <span
                      className="text-[10px] font-mono px-2 py-0.5 rounded-full font-medium"
                      style={{ backgroundColor: pctBg, color: pctColor }}
                    >
                      {focusPct}% focused
                    </span>
                  </div>
                  <p className="text-sm text-white truncate group-hover:text-flow-cyan transition-colors">
                    {session.goal}
                  </p>
                  <p className="text-xs text-flow-very-muted mt-0.5 font-mono">
                    {session.plannedDuration} min planned → {focusMin} min actual
                  </p>
                </div>
                <span className="text-flow-very-muted group-hover:text-flow-cyan transition-colors text-lg ml-4">
                  →
                </span>
              </div>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}
