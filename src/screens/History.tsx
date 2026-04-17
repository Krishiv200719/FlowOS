import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useSessionContext } from '../context/SessionContext';

const pageVariants = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.25, ease: 'easeOut' } },
  exit: { opacity: 0, y: -8, transition: { duration: 0.15, ease: 'easeIn' } },
};

export default function History() {
  // BUG #2 FIX: removed extensionConnected destructure and its early return gate
  const { sessions, loading, extensionConnected } = useSessionContext();
  const navigate = useNavigate();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="space-y-2 w-full max-w-lg">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="skeleton h-20 w-full rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  // Show all sessions sorted by recency
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
        <div className="w-10 h-10 rounded-lg border border-[#1C1C1C] flex items-center justify-center mb-4">
          <div className="w-4 h-5 border border-[#333] rounded-sm relative">
            <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-3 h-1 bg-[#333] rounded-sm" />
          </div>
        </div>
        <p className="text-lg font-medium text-white">No sessions recorded</p>
        <p className="text-sm text-flow-muted text-center max-w-xs">
          {extensionConnected
            ? 'Extension is connected. Start a focus session from the Chrome extension popup.'
            : 'Install the FlowOS Chrome extension to start tracking your focus sessions.'}
        </p>
      </motion.div>
    );
  }

  const totalFocusMin = Math.round(
    sorted.reduce((sum, s) => sum + s.stats.realFocusTime / 60000, 0)
  );

  return (
    <motion.div
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={{ duration: 0.25 }}
      className="space-y-6"
    >
      <div className="flex items-end justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Session History</h2>
          <p className="text-sm text-flow-muted mt-1">
            <span className="font-mono text-flow-cyan">{sorted.length}</span> sessions —{' '}
            <span className="font-mono text-flow-green">{totalFocusMin}</span> min of real focus
          </p>
        </div>
        {!extensionConnected && (
          <span className="text-[9px] font-mono text-flow-very-muted px-2 py-1 border border-dashed border-[#2A2A2A] rounded">
            DEMO DATA
          </span>
        )}
      </div>

      <div className="space-y-2">
        {sorted.map((session, i) => {
          const focusPct = Math.round(session.stats.focusRatio * 100);
          const focusMin = Math.round(session.stats.realFocusTime / 60000);
          const distractionMin = Math.round(session.stats.distractionTime / 60000);
          const idleMin = Math.round(session.stats.idleTime / 60000);
          const totalMs = session.stats.realFocusTime + session.stats.distractionTime + session.stats.idleTime;

          const pctColor =
            focusPct > 60 ? '#00D46A' : focusPct > 40 ? '#FF6B35' : '#FF3B3B';
          const pctBg =
            focusPct > 60 ? 'rgba(0,212,106,0.12)' : focusPct > 40 ? 'rgba(255,107,53,0.12)' : 'rgba(255,59,59,0.12)';

          const date = new Date(session.startTime);
          const now = new Date();
          const diffDays = Math.floor((now.getTime() - date.getTime()) / 86400000);
          let dateStr: string;
          if (diffDays === 0) dateStr = 'Today';
          else if (diffDays === 1) dateStr = 'Yesterday';
          else dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

          const timeStr = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

          // UPGRADE #6: mini session bar proportions
          const focusProp = totalMs > 0 ? (session.stats.realFocusTime / totalMs) * 100 : 0;
          const idleProp = totalMs > 0 ? (session.stats.idleTime / totalMs) * 100 : 0;
          const distProp = totalMs > 0 ? (session.stats.distractionTime / totalMs) * 100 : 0;

          const isLowFocus = focusPct < 40;

          return (
            <motion.div
              key={session.id}
              className="card-dashed px-5 py-4 cursor-pointer hover:bg-flow-elevated hover:border-flow-muted/30 transition-all duration-200 group"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
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
                    {isLowFocus && (
                      <span className="w-1.5 h-1.5 rounded-full bg-flow-red inline-block" title="Low focus session" />
                    )}
                    {!extensionConnected && (
                      <span className="text-[9px] font-mono text-flow-very-muted border border-[#2A2A2A] px-1 rounded">
                        demo
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-white truncate group-hover:text-flow-cyan transition-colors">
                    {session.goal}
                  </p>
                  <p className="text-xs text-flow-very-muted mt-0.5 font-mono">
                    {session.plannedDuration} min planned → {focusMin} min focus · {distractionMin}m distraction · {idleMin}m idle
                  </p>

                  {/* UPGRADE #6: Mini session bar */}
                  <div className="flex h-1.5 rounded-full overflow-hidden mt-2 gap-px">
                    {focusProp > 0 && (
                      <div style={{ width: `${focusProp}%`, backgroundColor: '#00D46A' }} />
                    )}
                    {idleProp > 0 && (
                      <div style={{ width: `${idleProp}%`, backgroundColor: '#FF6B35' }} />
                    )}
                    {distProp > 0 && (
                      <div style={{ width: `${distProp}%`, backgroundColor: '#FF3B3B' }} />
                    )}
                  </div>
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
