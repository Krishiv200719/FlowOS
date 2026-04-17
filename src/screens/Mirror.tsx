import { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { motion, useMotionValue, useTransform, animate } from 'framer-motion';
import { useSessionContext } from '../context/SessionContext';
import SessionTimeline from '../components/mirror/SessionTimeline';
import StatsGrid from '../components/mirror/StatsGrid';
import DistractionChart from '../components/mirror/DistractionChart';
import TopDistractors from '../components/mirror/TopDistractors';
import type { FocusSession } from '../types';

const pageVariants = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.25, ease: 'easeOut' } },
  exit: { opacity: 0, y: -8, transition: { duration: 0.15, ease: 'easeIn' } },
};

// Animated count-up number component
function CountUp({ to, suffix = '' }: { to: number; suffix?: string }) {
  const count = useMotionValue(0);
  const rounded = useTransform(count, (v) => Math.round(v));
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    const controls = animate(count, to, { duration: 1.2, ease: 'easeOut' });
    const unsubscribe = rounded.on('change', (v) => setDisplay(v));
    return () => { controls.stop(); unsubscribe(); };
  }, [to]);

  return <span>{display}{suffix}</span>;
}

export default function Mirror() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const { sessions, loading, extensionConnected } = useSessionContext();
  const [selectedSession, setSelectedSession] = useState<FocusSession | null>(null);

  // BUG #1 FIX: Only loading spinner as early return — no extension gate
  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="space-y-3">
          <div className="skeleton h-10 w-80 rounded" />
          <div className="skeleton h-8 w-64 rounded" />
          <div className="skeleton h-32 w-full rounded mt-6" />
        </div>
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <motion.div
        variants={pageVariants}
        initial="initial"
        animate="animate"
        exit="exit"
        className="flex flex-col items-center justify-center h-[60vh] space-y-4"
      >
        <div className="w-12 h-12 rounded-lg border border-[#1C1C1C] flex items-center justify-center mb-4">
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <rect x="3" y="1" width="12" height="14" rx="2" stroke="#333" strokeWidth="1.5"/>
            <path d="M6 16h6" stroke="#333" strokeWidth="1.5" strokeLinecap="round"/>
            <path d="M9 16v1" stroke="#333" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        </div>
        <p className="text-lg font-medium text-white">No sessions yet</p>
        <p className="text-sm text-flow-muted">Complete a focus session to see your Honest Mirror.</p>
      </motion.div>
    );
  }

  // Session tabs — 5 most recent sessions
  const recentSessions = [...sessions]
    .sort((a, b) => b.startTime - a.startTime)
    .slice(0, 5);

  // Default to worst session unless a specific one is selected
  const worstSession = sessions.reduce((worst, s) =>
    s.stats.focusRatio < worst.stats.focusRatio ? s : worst
  );

  const activeSession = selectedSession
    ?? (sessionId ? sessions.find((s) => s.id === sessionId) ?? worstSession : worstSession);

  const { stats } = activeSession;
  const focusMin = Math.round(stats.realFocusTime / 60000);
  const distractionMin = Math.round(stats.distractionTime / 60000);
  const idleMin = Math.round(stats.idleTime / 60000);
  const totalLostMin = distractionMin + idleMin;
  const recoveryMs = stats.avgRecoveryTime;
  const recoveryMin = Math.round(recoveryMs / 60000);
  const recoverySecActual = Math.round(recoveryMs / 1000);
  const focusPct = Math.round(stats.focusRatio * 100);
  const totalDuration = activeSession.endTime - activeSession.startTime;

  // True cost: distraction min + recovery min per distraction
  const distractionCount = stats.topDistractors.length;
  const trueCostPerDist = distractionCount > 0
    ? Math.round((distractionMin + recoveryMin * distractionCount) / distractionCount)
    : recoveryMin + 2;

  const pctColor =
    focusPct < 40 ? '#FF3B3B' : focusPct < 70 ? '#FF6B35' : '#00D46A';

  const sessionDate = new Date(activeSession.startTime).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });

  return (
    <motion.div
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      className="space-y-8"
    >
      {/* UPGRADE #1: Session Selector Tabs */}
      <div className="flex flex-wrap gap-2">
        {recentSessions.map((s) => {
          const pct = Math.round(s.stats.focusRatio * 100);
          const isActive = s.id === activeSession.id;
          const tabColor = pct < 40 ? '#FF3B3B' : pct < 70 ? '#FF6B35' : '#00D46A';
          return (
            <button
              key={s.id}
              onClick={() => setSelectedSession(s)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-[11px] font-mono transition-all border ${
                isActive
                  ? 'border-flow-cyan bg-flow-cyan/10 text-flow-cyan'
                  : 'border-[#2A2A2A] bg-[#111111] text-flow-muted hover:border-flow-muted/50 hover:text-white'
              }`}
            >
              <span className="truncate max-w-[120px]">{s.goal}</span>
              <span
                className="shrink-0 px-1.5 py-0.5 rounded text-[9px] font-bold"
                style={{ color: tabColor, backgroundColor: `${tabColor}18` }}
              >
                {pct}%
              </span>
            </button>
          );
        })}
        {!extensionConnected && (
          <span className="text-[9px] font-mono text-flow-very-muted self-center ml-1 px-2 py-1 border border-dashed border-[#2A2A2A] rounded">
            DEMO
          </span>
        )}
      </div>

      {/* DESIGN #1: Mirror Headline Typography */}
      <div key={activeSession.id} className="space-y-1">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
        >
          <span className="text-lg font-mono uppercase tracking-widest text-flow-muted">YOU PLANNED </span>
          <span className="text-4xl font-bold font-mono text-white">{activeSession.plannedDuration}</span>
          <span className="text-lg font-mono uppercase tracking-widest text-flow-muted"> MIN.</span>
        </motion.div>

        <div className="h-px bg-[#1C1C1C] my-2" />

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
        >
          <span className="text-lg font-mono uppercase tracking-widest" style={{ color: pctColor }}>
            YOU FOCUSED FOR{' '}
          </span>
          <span className="text-5xl font-bold font-mono" style={{ color: pctColor }}>
            <CountUp to={focusMin} />
          </span>
          <span className="text-lg font-mono uppercase tracking-widest" style={{ color: pctColor }}>
            {' '}MIN.{' '}
          </span>
          <span className="text-2xl font-mono font-bold" style={{ color: pctColor, opacity: 0.75 }}>
            (<CountUp to={focusPct} suffix="%" />)
          </span>
        </motion.div>

        <motion.p
          className="text-xs text-flow-muted mt-2 font-mono"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          {activeSession.goal}
          <span className="text-flow-very-muted mx-2">•</span>
          {sessionDate}
        </motion.p>
      </div>

      {/* UPGRADE #2: Animated Truth Counter */}
      <motion.div
        className="card-dashed px-6 py-5 flex items-center gap-4"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
      >
        <span className="text-2xl">⏱</span>
        <div>
          <p className="text-[10px] font-mono uppercase tracking-widest text-flow-muted mb-1">
            Time Actually Lost to Distractions
          </p>
          <p className="text-3xl font-bold font-mono" style={{ color: '#FF3B3B' }}>
            <CountUp to={totalLostMin} suffix=" min" />
          </p>
          <p className="text-[10px] font-mono text-flow-very-muted mt-0.5">
            That's{' '}
            <span className="text-flow-red font-medium">
              {Math.round((totalLostMin / activeSession.plannedDuration) * 100)}%
            </span>{' '}
            of your planned session gone.
          </p>
        </div>
      </motion.div>

      {/* Timeline */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
      >
        <SessionTimeline events={activeSession.events} totalDuration={totalDuration} />
      </motion.div>

      {/* DESIGN #3: Stats Grid Upgrade */}
      <StatsGrid
        realFocusMin={focusMin}
        timeLostMin={totalLostMin}
        tabSwitches={stats.tabSwitches}
        avgRecoveryMin={recoveryMin}
        plannedMin={activeSession.plannedDuration}
        distractionMin={distractionMin}
        trueCostPerDist={trueCostPerDist}
        recoverySecActual={recoverySecActual}
      />

      {/* Distraction Breakdown */}
      <div className="grid grid-cols-[1fr_1fr] gap-6">
        <DistractionChart
          focusMs={stats.realFocusTime}
          idleMs={stats.idleTime}
          distractionMs={stats.distractionTime}
        />
        <TopDistractors distractors={stats.topDistractors} />
      </div>

      {/* Recovery Insight */}
      {recoverySecActual > 30 && (
        <motion.div
          className="card-dashed px-6 py-5 border-l-2 border-flow-orange"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
        >
          <p className="text-[10px] font-mono uppercase tracking-widest text-flow-orange mb-2">
            True Cost of Each Distraction
          </p>
          <p className="text-sm text-flow-muted leading-relaxed">
            Every time you got distracted, it took your brain an average of{' '}
            <span className="font-mono text-flow-orange font-bold">
              {recoverySecActual}s
            </span>{' '}
            to fully re-engage. That 2-minute YouTube visit actually cost you{' '}
            <span className="font-mono text-flow-red font-bold">
              {trueCostPerDist} minutes
            </span>
            . Your distractions didn't steal 2 minutes. They stole your session.
          </p>
        </motion.div>
      )}
    </motion.div>
  );
}
