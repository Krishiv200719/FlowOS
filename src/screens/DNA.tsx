import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useSessionContext } from '../context/SessionContext';
import { getAIInsights } from '../lib/gemini';
import { saveInsights, getInsights } from '../lib/db';
import { getHourlyHeatmap } from '../lib/patterns';
import { getDailyScores } from '../lib/scoring';
import type { AIInsights } from '../types';
import FocusDNA from '../components/dna/FocusDNA';
import HeatmapGrid from '../components/dna/HeatmapGrid';
import TrendSparkline from '../components/dna/TrendSparkline';

const pageVariants = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -10 },
};

export default function DNA() {
  const { sessions, loading: sessionsLoading, extensionConnected } = useSessionContext();
  const [insights, setInsights] = useState<AIInsights | null>(null);
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [insightsError, setInsightsError] = useState<string | null>(null);

  useEffect(() => {
    if (sessionsLoading || sessions.length < 3) return;

    setInsightsLoading(true);
    setInsightsError(null);

    // 1. Try cache first
    getInsights()
      .then((cached) => {
        if (cached) {
          console.log('[FlowOS] Loaded insights from cache.');
          setInsights(cached);
          setInsightsLoading(false);
          return;
        }
        // 2. Cache miss — call Gemini
        return getAIInsights(sessions)
          .then((data) => {
            setInsights(data);
            // 3. Persist to IndexedDB cache
            return saveInsights(data);
          });
      })
      .catch((err) => {
        console.error('[FlowOS] AI insights error:', err);
        setInsights(null);
        setInsightsError(err.message || 'Failed to load AI insights');
      })
      .finally(() => setInsightsLoading(false));
  }, [sessions, sessionsLoading]);

  // ─── Loading State ────────────────────────────────────
  if (sessionsLoading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="text-flow-muted text-sm font-mono animate-pulse">
          Loading sessions...
        </div>
      </div>
    );
  }

  // ─── Not Enough Sessions ──────────────────────────────
  if (sessions.length < 3) {
    return (
      <motion.div
        variants={pageVariants}
        initial="initial"
        animate="animate"
        exit="exit"
        transition={{ duration: 0.3 }}
        className="flex flex-col items-center justify-center h-[60vh] space-y-5"
      >
        <span className="text-5xl">🧬</span>
        <p className="text-xl font-bold text-white">
          Complete 3 sessions to unlock Focus DNA
        </p>
        <div className="w-72 h-3 bg-flow-elevated rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-flow-cyan to-flow-green rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${(sessions.length / 3) * 100}%` }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
          />
        </div>
        <p className="text-sm text-flow-muted font-mono">
          {sessions.length}/3 sessions completed
        </p>
        {sessions.length > 0 && (
          <p className="text-xs text-flow-very-muted">
            {3 - sessions.length} more session{3 - sessions.length > 1 ? 's' : ''} to go!
          </p>
        )}
      </motion.div>
    );
  }

  // ─── Main View ────────────────────────────────────────
  const heatmapData = getHourlyHeatmap(sessions);
  const dailyScores = getDailyScores(sessions, 7);

  return (
    <motion.div
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={{ duration: 0.3 }}
      className="space-y-8"
    >
      {/* Header + Refresh Button */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">YOUR FOCUS DNA</h2>
          <p className="text-sm text-flow-muted mt-1">
            Gemini-powered analysis of your{' '}
            <span className="font-mono text-flow-cyan">{sessions.length}</span>{' '}
            recorded sessions
          </p>
        </div>
        <button
          onClick={async () => {
            setInsightsLoading(true);
            setInsightsError(null);
            try {
              const fresh = await getAIInsights(sessions);
              setInsights(fresh);
              await saveInsights(fresh);
            } catch (err: any) {
              setInsightsError(err.message);
            } finally {
              setInsightsLoading(false);
            }
          }}
          disabled={insightsLoading}
          className="text-[10px] font-mono text-flow-cyan border border-dashed border-flow-cyan/30 rounded px-3 py-1.5 hover:bg-flow-cyan/5 transition-colors disabled:opacity-40"
        >
          ↻ Refresh Analysis
        </button>
      </div>

      {/* Heatmap */}
      <motion.div
        className="card-dashed p-5"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1 }}
      >
        <HeatmapGrid data={heatmapData} />
      </motion.div>

      {/* AI Insights */}
      {insightsLoading ? (
        <div className="space-y-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-4 h-4 border-2 border-flow-cyan border-t-transparent rounded-full animate-spin" />
            <span className="text-xs text-flow-cyan font-mono">
              ANALYZING WITH GEMINI...
            </span>
          </div>
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="card-dashed px-5 py-6 animate-pulse"
            >
              <div className="h-2 w-20 bg-flow-elevated rounded mb-3" />
              <div className="h-4 w-48 bg-flow-elevated rounded" />
            </div>
          ))}
        </div>
      ) : insightsError ? (
        <motion.div
          className="bg-flow-card border border-flow-red/20 rounded-lg px-6 py-6 text-center space-y-3"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <span className="text-3xl">⚠️</span>
          <p className="text-sm text-flow-red font-medium">
            Failed to load AI insights
          </p>
          <p className="text-xs text-flow-muted max-w-md mx-auto">
            {insightsError}
          </p>
          {insightsError.includes('VITE_GEMINI_API_KEY') && (
            <div className="card-dashed px-4 py-3 inline-block mt-2">
              <p className="text-[10px] text-flow-very-muted font-mono text-left">
                1. Create a .env file in the flowos/ directory<br />
                2. Add: VITE_GEMINI_API_KEY=your_key_here<br />
                3. Restart the dev server (npm run dev)
              </p>
            </div>
          )}
          <button
            onClick={() => window.location.reload()}
            className="text-xs font-mono text-flow-cyan border border-dashed border-flow-cyan/30 rounded px-4 py-2 hover:bg-flow-cyan/5 transition-colors mt-2"
          >
            ↻ Retry
          </button>
        </motion.div>
      ) : insights ? (
        <FocusDNA insights={insights} />
      ) : null}

      {/* Weekly Trend */}
      <TrendSparkline data={dailyScores} />

      {/* Demo mode banner */}
      {!extensionConnected && (
        <div className="flex items-center gap-3 px-4 py-3 border border-dashed border-[#2A2A2A] rounded-lg">
          <span className="text-[10px] font-mono text-flow-very-muted">
            ○ DEMO MODE — Install the Chrome extension to track real sessions
          </span>
        </div>
      )}
    </motion.div>
  );
}
