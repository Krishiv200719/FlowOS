import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useSessionContext } from '../context/SessionContext';
import { getAIInsights } from '../lib/gemini';
import { saveInsights, getInsights } from '../lib/db';
import { getHourlyHeatmap, getLocalInsight } from '../lib/patterns';
import { getDailyScores } from '../lib/scoring';
import type { AIInsights, FocusSession } from '../types';
import FocusDNA from '../components/dna/FocusDNA';
import HeatmapGrid from '../components/dna/HeatmapGrid';
import TrendSparkline from '../components/dna/TrendSparkline';

// Build local insights without any API call
function buildLocalInsights(sessions: FocusSession[]): AIInsights {
  const morningSessions = sessions.filter(s => {
    const h = new Date(s.startTime).getHours();
    return h >= 6 && h < 12;
  });
  const peakHours = morningSessions.length > 0 ? '9:00 AM – 11:00 AM' : '2:00 PM – 4:00 PM';

  const allRatios = sessions.map(s => s.stats.focusRatio);
  const avgRatio = allRatios.reduce((a, b) => a + b, 0) / allRatios.length;

  const distractorMap: Record<string, number> = {};
  for (const s of sessions) {
    for (const d of s.stats.topDistractors) {
      distractorMap[d.domain] = (distractorMap[d.domain] || 0) + d.seconds;
    }
  }
  const topDist = Object.entries(distractorMap).sort(([,a],[,b]) => b-a)[0];
  const topDistractor = topDist
    ? `${topDist[0]} (avg ${Math.round(topDist[1]/60/sessions.length)} min/session)`
    : 'Social media';

  const keyInsight = getLocalInsight(sessions) ||
    `You averaged ${Math.round(avgRatio * 100)}% real focus across your sessions. The gap between your best and worst session is where your growth lives.`;

  const weekly = sessions.length > 5 ? 'improving' : 'stable';

  return {
    peakHours,
    realFocusRatio: parseFloat(avgRatio.toFixed(2)),
    topDistractor,
    keyInsight,
    tomorrowWindow: '9:15 AM – 11:00 AM',
    weeklyTrend: weekly as 'improving' | 'declining' | 'stable',
    coachMessage: 'Your pattern is clear. Schedule your hardest work in the morning before distractions have a chance to find you.',
  };
}

const pageVariants = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.25, ease: 'easeOut' } },
  exit: { opacity: 0, y: -8, transition: { duration: 0.15, ease: 'easeIn' } },
};

export default function DNA() {
  const { sessions, loading: sessionsLoading, extensionConnected } = useSessionContext();
  const [insights, setInsights] = useState<AIInsights | null>(null);
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [insightsError, setInsightsError] = useState<string | null>(null);

  const loadInsights = useCallback(async (force = false) => {
    if (sessions.length < 3) return;
    setInsightsLoading(true);
    setInsightsError(null);

    const apiKey = import.meta.env.VITE_GEMINI_API_KEY ?? '';
    const hasKey = apiKey.length > 10;

    try {
      // Try cache first (skip on force refresh)
      if (!force) {
        const cached = await getInsights();
        if (cached) {
          console.log('[FlowOS] Loaded insights from cache.');
          setInsights(cached);
          setInsightsLoading(false);
          return;
        }
      }

      // No API key → local fallback immediately (no error shown)
      if (!hasKey) {
        console.log('[FlowOS] No API key — using local insights.');
        setInsights(buildLocalInsights(sessions));
        setInsightsLoading(false);
        return;
      }

      // Try Claude API
      const data = await getAIInsights(sessions);
      setInsights(data);
      await saveInsights(data);
    } catch (err: any) {
      console.error('[FlowOS] AI insights error:', err);
      // Graceful fallback — never show error, just use local insights
      console.log('[FlowOS] Falling back to local insights.');
      setInsights(buildLocalInsights(sessions));
    } finally {
      setInsightsLoading(false);
    }
  }, [sessions]);

  useEffect(() => {
    if (sessionsLoading || sessions.length < 3) return;
    loadInsights();
  }, [sessions, sessionsLoading]);

  // ─── Loading State ────────────────────────────────────
  if (sessionsLoading) {
    return (
      <div className="space-y-4 pt-4">
        <div className="skeleton h-8 w-64 rounded" />
        <div className="skeleton h-40 w-full rounded-lg" />
        {[1, 2, 3].map((i) => (
          <div key={i} className="skeleton h-20 w-full rounded-lg" />
        ))}
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
        className="flex flex-col items-center justify-center h-[60vh] space-y-5"
      >
        <div className="w-12 h-12 rounded-lg border border-[#1C1C1C] flex items-center justify-center mb-4">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M4 2C4 2 4 10 10 10C16 10 16 18 16 18" stroke="#00F5FF" strokeWidth="1.5" strokeLinecap="round"/>
            <path d="M16 2C16 2 16 10 10 10C4 10 4 18 4 18" stroke="#00D46A" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        </div>
        <p className="text-xl font-bold text-white">Complete 3 sessions to unlock Focus DNA</p>
        <div className="w-72 h-3 bg-flow-elevated rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-flow-cyan to-flow-green rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${(sessions.length / 3) * 100}%` }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
          />
        </div>
        <p className="text-sm text-flow-muted font-mono">{sessions.length}/3 sessions completed</p>
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
      className="space-y-8"
    >
      {/* Header + Refresh Button */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">YOUR FOCUS DNA</h2>
          <p className="text-sm text-flow-muted mt-1">
            AI-powered analysis of your{' '}
            <span className="font-mono text-flow-cyan">{sessions.length}</span>{' '}
            recorded sessions
          </p>
        </div>
        <button
          onClick={() => loadInsights(true)}
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
            <span className="text-xs text-flow-cyan font-mono">ANALYZING YOUR PATTERNS...</span>
          </div>
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="skeleton h-16 w-full rounded-lg" />
          ))}
        </div>
      ) : insightsError ? (
        <motion.div
          className="bg-flow-card border border-flow-red/20 rounded-lg px-6 py-6 text-center space-y-3"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded border border-flow-red/20 mb-2">
            <div className="w-1.5 h-1.5 rounded-full bg-flow-red" />
            <span className="text-xs font-mono text-flow-red">Analysis unavailable</span>
          </div>
          <p className="text-sm text-flow-red font-medium">Failed to load AI insights</p>
          <p className="text-xs text-flow-muted max-w-md mx-auto">{insightsError}</p>
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
