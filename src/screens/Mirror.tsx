import { useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useSessionContext } from '../context/SessionContext';
import SessionTimeline from '../components/mirror/SessionTimeline';
import StatsGrid from '../components/mirror/StatsGrid';
import DistractionChart from '../components/mirror/DistractionChart';
import TopDistractors from '../components/mirror/TopDistractors';

const pageVariants = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -10 },
};

export default function Mirror() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const { sessions, loading, extensionConnected } = useSessionContext();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="text-flow-muted text-sm font-mono animate-pulse">
          Loading session...
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
          Install the FlowOS extension to see your session data.
        </p>
      </motion.div>
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
        <span className="text-4xl">🪞</span>
        <p className="text-lg font-medium text-white">No sessions yet</p>
        <p className="text-sm text-flow-muted">
          Complete a focus session to see your Honest Mirror.
        </p>
      </motion.div>
    );
  }

  // Find session by ID, or show the most recent
  let session;
  if (sessionId) {
    session = sessions.find((s) => s.id === sessionId);
  }
  if (!session) {
    session = sessions.reduce((a, b) => (a.startTime > b.startTime ? a : b));
  }

  const { stats } = session;
  const focusMin = Math.round(stats.realFocusTime / 60000);
  const totalLostMs = stats.distractionTime + stats.idleTime;
  const lostMin = Math.round(totalLostMs / 60000);
  const recoveryMin = Math.round(stats.avgRecoveryTime / 60000);
  const focusPct = Math.round(stats.focusRatio * 100);
  const totalDuration = session.endTime - session.startTime;

  const pctColor =
    focusPct < 40 ? '#FF3B3B' : focusPct < 70 ? '#FF6B35' : '#00D46A';

  const sessionDate = new Date(session.startTime).toLocaleDateString('en-US', {
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
      transition={{ duration: 0.3 }}
      className="space-y-8"
    >
      {/* Headline */}
      <div>
        <motion.p
          className="text-3xl font-bold text-white leading-tight"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          YOU PLANNED{' '}
          <span className="font-mono">{session.plannedDuration}</span> MIN.
        </motion.p>
        <motion.p
          className="text-3xl font-bold leading-tight mt-1"
          style={{ color: pctColor }}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          YOU FOCUSED FOR{' '}
          <span className="font-mono">{focusMin}</span> MIN.{' '}
          <span className="text-2xl opacity-80">({focusPct}%)</span>
        </motion.p>
        <motion.p
          className="text-sm text-flow-muted mt-2"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          Session goal:{' '}
          <span className="text-flow-very-muted">{session.goal}</span>
          <span className="text-flow-very-muted ml-3">•</span>
          <span className="text-flow-very-muted ml-3">{sessionDate}</span>
        </motion.p>
      </div>

      {/* Timeline */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
      >
        <SessionTimeline events={session.events} totalDuration={totalDuration} />
      </motion.div>

      {/* Stats Grid */}
      <StatsGrid
        realFocusMin={focusMin}
        timeLostMin={lostMin}
        tabSwitches={stats.tabSwitches}
        avgRecoveryMin={recoveryMin}
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
      {recoveryMin > 0 && (
        <motion.div
          className="bg-flow-card border border-flow-border rounded-lg px-6 py-5"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
        >
          <p className="text-sm text-flow-muted leading-relaxed">
            Every time you got distracted, it took you an average of{' '}
            <span className="font-mono text-flow-orange font-medium">
              {recoveryMin} minutes
            </span>{' '}
            to fully return to deep work. That distraction didn't cost you 2
            minutes. It cost you{' '}
            <span className="font-mono text-flow-red font-medium">
              {2 + recoveryMin} minutes
            </span>
            .
          </p>
        </motion.div>
      )}
    </motion.div>
  );
}
