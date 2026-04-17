// ═══════════════════════════════════════════════════════════
// FlowOS — Activity Screen (Feature B: Last 2 Hours)
// Ambient tracking — every site you visited, no session needed
// ═══════════════════════════════════════════════════════════

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useSessionContext } from '../context/SessionContext';
import { getAmbientLog } from '../lib/bridge';
import type { AmbientEntry } from '../lib/bridge';
import { getActivityInsights } from '../lib/activityInsights';

const pageVariants = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.25, ease: 'easeOut' } },
  exit: { opacity: 0, y: -8, transition: { duration: 0.15, ease: 'easeIn' } },
};

function domainColor(domain: string, isDistraction: boolean): string {
  if (isDistraction) return '#FF3B3B';
  if (domain.includes('github') || domain.includes('vscode') || domain.includes('stackoverflow')) return '#00D46A';
  if (domain.includes('google') || domain.includes('notion') || domain.includes('docs')) return '#00F5FF';
  return '#888888';
}

function summarizeLog(log: AmbientEntry[]) {
  const map: Record<string, { totalMs: number; isDistraction: boolean }> = {};
  for (const entry of log) {
    if (!map[entry.domain]) map[entry.domain] = { totalMs: 0, isDistraction: entry.isDistraction };
    map[entry.domain].totalMs += entry.duration;
  }
  return Object.entries(map)
    .map(([domain, v]) => ({ domain, ...v }))
    .sort((a, b) => b.totalMs - a.totalMs);
}

function getLocalFallback(log: AmbientEntry[]): string {
  const distractionMs = log.filter(e => e.isDistraction).reduce((s, e) => s + e.duration, 0);
  const totalMs = log.reduce((s, e) => s + e.duration, 0);
  const min = Math.round(distractionMs / 60000);
  const pct = totalMs > 0 ? Math.round((distractionMs / totalMs) * 100) : 0;
  if (min > 30) {
    return `You've spent ${min} minutes (${pct}% of your last 2 hours) on distraction sites.\n\nTo get back into focus:\n1. Close all distraction tabs now\n2. Write down the ONE thing you need to work on\n3. Start a 25-minute FlowOS session immediately\n\nThe longer you wait, the harder it gets.`;
  }
  return `Your last 2 hours look mostly productive — ${min} minutes on distraction sites. That's under control.\n\nKeep the momentum. Start a focus session to lock in the next 60 minutes.`;
}

// ─── Groq AI Section Renderer ───────────────────────────────
// Parses structured AI text into styled section cards

const SECTION_CONFIG: Record<string, { icon: string; color: string; bg: string }> = {
  'VERDICT':               { icon: '⚡', color: '#FF6B35', bg: 'rgba(255,107,53,0.06)' },
  'WHAT THE DATA SHOWS':   { icon: '📊', color: '#00F5FF', bg: 'rgba(0,245,255,0.05)' },
  'YOUR FOCUS PATTERN':    { icon: '🔁', color: '#9D6AFF', bg: 'rgba(157,106,255,0.05)' },
  'WHERE THE TIME REALLY WENT': { icon: '🕰️', color: '#FF3B3B', bg: 'rgba(255,59,59,0.05)' },
  'ROOT CAUSE':            { icon: '🎯', color: '#FF6B35', bg: 'rgba(255,107,53,0.06)' },
  'YOUR NEXT 60 MINUTES — DO THIS NOW': { icon: '✅', color: '#00D46A', bg: 'rgba(0,212,106,0.06)' },
  'FOCUS FORECAST':        { icon: '🔮', color: '#00F5FF', bg: 'rgba(0,245,255,0.05)' },
};

function GroqInsightRenderer({ text }: { text: string }) {
  // Parse sections from the structured text
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const sections: Array<{ title: string; lines: string[] }> = [];
  let current: { title: string; lines: string[] } | null = null;

  for (const line of lines) {
    // Detect section headers (ends with : and is all uppercase or in config)
    const headerMatch = Object.keys(SECTION_CONFIG).find(k => line.toUpperCase().startsWith(k));
    if (headerMatch || (line.endsWith(':') && line.length < 50 && line === line.toUpperCase())) {
      if (current) sections.push(current);
      const title = headerMatch ?? line.replace(':', '').trim();
      const rest = headerMatch ? line.slice(headerMatch.length).replace(/^:\s*/, '').trim() : '';
      current = { title, lines: rest ? [rest] : [] };
    } else if (current) {
      current.lines.push(line);
    } else {
      // Content before first header — preamble
      if (!sections.find(s => s.title === '_preamble')) {
        sections.unshift({ title: '_preamble', lines: [] });
      }
      sections[0].lines.push(line);
    }
  }
  if (current) sections.push(current);

  if (sections.length === 0) {
    // Fallback: plain text
    return (
      <div className="px-5 py-4 bg-[#0D0D0D] border border-[#1C1C1C] rounded-lg">
        <p className="text-sm text-white leading-relaxed whitespace-pre-line">{text}</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 pb-1">
        <div className="w-1.5 h-1.5 rounded-full bg-flow-cyan" />
        <span className="text-[10px] font-mono uppercase tracking-widest text-flow-cyan">
          Groq AI — LLaMA 3.3 70B — Activity Analysis
        </span>
      </div>
      {sections.map((section, i) => {
        if (section.title === '_preamble') return null;
        const cfg = SECTION_CONFIG[section.title] ?? { icon: '—', color: '#888', bg: 'rgba(136,136,136,0.04)' };
        const isActions = section.title.includes('NEXT 60');
        const actionItems = isActions
          ? section.lines.filter(l => /^\d+\./.test(l))
          : [];
        const bodyLines = isActions
          ? section.lines.filter(l => !/^\d+\./.test(l))
          : section.lines;

        return (
          <motion.div
            key={section.title}
            className="rounded-lg px-4 py-4 border"
            style={{ background: cfg.bg, borderColor: `${cfg.color}22` }}
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
          >
            <div className="flex items-center gap-2 mb-2">
              <span className="text-sm">{cfg.icon}</span>
              <span className="text-[9px] font-mono uppercase tracking-widest" style={{ color: cfg.color }}>
                {section.title}
              </span>
            </div>

            {bodyLines.map((line, j) => (
              <p key={j} className="text-sm text-white/90 leading-relaxed mb-1">{line}</p>
            ))}

            {actionItems.length > 0 && (
              <div className="space-y-2 mt-2">
                {actionItems.map((item, j) => {
                  const text = item.replace(/^\d+\.\s*/, '');
                  return (
                    <div key={j} className="flex items-start gap-3 px-3 py-2.5 rounded-md"
                      style={{ background: 'rgba(0,212,106,0.08)', border: '1px solid rgba(0,212,106,0.12)' }}>
                      <span className="text-[10px] font-mono font-bold text-flow-green mt-0.5 flex-shrink-0">
                        {j + 1}
                      </span>
                      <p className="text-sm text-white/90 leading-relaxed">{text}</p>
                    </div>
                  );
                })}
              </div>
            )}
          </motion.div>
        );
      })}
    </div>
  );
}


export default function Activity() {
  const { extensionConnected } = useSessionContext();
  const [log, setLog] = useState<AmbientEntry[]>([]);
  const [insights, setInsights] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [insightsLoading, setInsightsLoading] = useState(false);

  const loadLog = useCallback(async () => {
    setLoading(true);
    try {
      if (extensionConnected) {
        const data = await getAmbientLog();
        setLog(data ?? []);
      }
    } catch (_) {}
    finally { setLoading(false); }
  }, [extensionConnected]);

  useEffect(() => {
    loadLog();
    const id = setInterval(loadLog, 30000);
    return () => clearInterval(id);
  }, [loadLog]);

  const analyzeWithAI = useCallback(async () => {
    if (!log.length) return;
    setInsightsLoading(true);
    try {
      const result = await getActivityInsights(log);
      setInsights(result);
    } catch {
      setInsights(getLocalFallback(log));
    } finally {
      setInsightsLoading(false);
    }
  }, [log]);

  if (loading) {
    return (
      <div className="space-y-4 pt-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-16 bg-[#0D0D0D] border border-[#1C1C1C] rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  if (!extensionConnected) {
    return (
      <motion.div variants={pageVariants} initial="initial" animate="animate" exit="exit"
        className="flex flex-col items-center justify-center h-[60vh] space-y-4 text-center"
      >
        <div className="text-4xl">📡</div>
        <p className="text-lg font-bold text-white">Extension Required</p>
        <p className="text-sm text-flow-muted max-w-xs">
          Install the FlowOS Chrome extension to enable ambient activity tracking.
          It runs silently in the background.
        </p>
      </motion.div>
    );
  }

  if (!log.length) {
    return (
      <motion.div variants={pageVariants} initial="initial" animate="animate" exit="exit"
        className="flex flex-col items-center justify-center h-[60vh] space-y-4 text-center"
      >
        <div className="text-4xl">⏳</div>
        <p className="text-lg font-bold text-white">Tracking your activity...</p>
        <p className="text-sm text-flow-muted max-w-xs">
          FlowOS is running. Come back in a few minutes to see where your time is going.
        </p>
        <button onClick={loadLog}
          className="text-xs font-mono text-flow-cyan border border-dashed border-flow-cyan/30 rounded px-4 py-2 hover:bg-flow-cyan/5 transition-colors">
          ↻ Check Now
        </button>
      </motion.div>
    );
  }

  const summary = summarizeLog(log);
  const totalMs = log.reduce((s, e) => s + e.duration, 0);
  const distractionMs = log.filter(e => e.isDistraction).reduce((s, e) => s + e.duration, 0);
  const distractionPct = totalMs > 0 ? Math.round((distractionMs / totalMs) * 100) : 0;
  const startTime = log[0]?.timestamp ?? Date.now();
  const spanMin = Math.round((Date.now() - startTime) / 60000);

  return (
    <motion.div variants={pageVariants} initial="initial" animate="animate" exit="exit" className="space-y-8">

      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight">LAST 2 HOURS</h2>
          <p className="text-sm text-flow-muted mt-1">Ambient tracking — no session required</p>
        </div>
        <button onClick={loadLog}
          className="text-[10px] font-mono text-flow-cyan border border-dashed border-flow-cyan/30 rounded px-3 py-1.5 hover:bg-flow-cyan/5 transition-colors">
          ↻ Refresh
        </button>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { value: `${Math.round(totalMs / 60000)}m`, label: 'Tracked', color: 'text-white' },
          { value: `${distractionPct}%`, label: 'Distraction', color: distractionPct > 40 ? 'text-flow-red' : 'text-flow-green' },
          { value: `${summary.length}`, label: 'Sites visited', color: 'text-flow-cyan' },
        ].map((stat, i) => (
          <motion.div key={stat.label}
            className="px-4 py-4 bg-[#0D0D0D] border border-[#1C1C1C] rounded-lg"
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }}
          >
            <p className={`text-2xl font-bold font-mono ${stat.color}`}>{stat.value}</p>
            <p className="text-[10px] font-mono uppercase tracking-wider text-flow-muted mt-1">{stat.label}</p>
          </motion.div>
        ))}
      </div>

      {/* Timeline Bar */}
      <div className="space-y-3">
        <h3 className="text-xs font-mono uppercase tracking-widest text-flow-muted">
          Activity Timeline (last {spanMin} min)
        </h3>
        <div className="flex h-7 rounded-md overflow-hidden border border-[#1C1C1C] gap-px">
          {log.filter(e => e.duration > 10000).map((entry, i) => {
            const w = totalMs > 0 ? (entry.duration / totalMs) * 100 : 0;
            if (w < 0.5) return null;
            return (
              <motion.div key={i}
                className="h-full cursor-default"
                style={{ width: `${w}%`, backgroundColor: domainColor(entry.domain, entry.isDistraction), minWidth: 2, opacity: 0.8 }}
                initial={{ opacity: 0 }} animate={{ opacity: 0.8 }} transition={{ delay: i * 0.015 }}
                title={`${entry.domain} — ${Math.round(entry.duration / 60000)}m`}
              />
            );
          })}
        </div>
        <div className="flex gap-5 text-xs">
          {[['#00D46A', 'Productive'], ['#FF3B3B', 'Distraction'], ['#888', 'Other']].map(([color, label]) => (
            <div key={label} className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
              <span className="text-flow-muted">{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Site Breakdown */}
      <div className="space-y-3">
        <h3 className="text-xs font-mono uppercase tracking-widest text-flow-muted">Where Your Time Went</h3>
        <div className="space-y-2">
          {summary.slice(0, 8).map((item, i) => {
            const pct = totalMs > 0 ? Math.round((item.totalMs / totalMs) * 100) : 0;
            const min = Math.round(item.totalMs / 60000);
            const color = domainColor(item.domain, item.isDistraction);
            return (
              <motion.div key={item.domain}
                className="relative px-4 py-3 bg-[#0D0D0D] border border-[#1C1C1C] rounded-lg overflow-hidden"
                initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}
              >
                <div className="absolute inset-0 rounded-lg opacity-[0.08]" style={{ width: `${pct}%`, backgroundColor: color }} />
                <div className="relative flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                    <span className="text-sm text-white font-mono">{item.domain}</span>
                    {item.isDistraction && (
                      <span className="text-[9px] font-mono text-flow-red border border-flow-red/30 px-1.5 py-0.5 rounded">DISTRACTION</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <span className="text-xs font-mono text-flow-muted">{min}m</span>
                    <span className="text-xs font-mono text-[#444]">{pct}%</span>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* AI Analysis */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-mono uppercase tracking-widest text-flow-muted">Groq AI Coach</h3>
          {!insights && (
            <button onClick={analyzeWithAI} disabled={insightsLoading}
              className="text-[10px] font-mono text-flow-cyan border border-dashed border-flow-cyan/30 rounded px-3 py-1.5 hover:bg-flow-cyan/5 transition-colors disabled:opacity-40">
              {insightsLoading ? '⏳ Analyzing...' : '✨ Analyze My Activity'}
            </button>
          )}
        </div>

        {insightsLoading && (
          <div className="px-5 py-8 bg-[#0D0D0D] border border-[#1C1C1C] rounded-lg">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-4 h-4 border-2 border-flow-cyan border-t-transparent rounded-full animate-spin" />
              <span className="text-xs text-flow-cyan font-mono">Groq LLaMA 3.3 70B is analyzing your session...</span>
            </div>
            <div className="space-y-2">
              {['Mapping your context-switching patterns...', 'Identifying focus drains...', 'Building your action plan...'].map((step, i) => (
                <div key={step} className="flex items-center gap-2">
                  <div className="w-1 h-1 rounded-full bg-flow-cyan/40" />
                  <span className="text-[10px] font-mono text-[#444]" style={{ animationDelay: `${i * 0.3}s` }}>{step}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {insights && (
          <motion.div
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            className="space-y-3"
          >
            <GroqInsightRenderer text={insights} />
            <button onClick={analyzeWithAI}
              className="text-[10px] font-mono text-flow-cyan/50 hover:text-flow-cyan transition-colors">
              ↻ Re-analyze with Groq AI
            </button>
          </motion.div>
        )}

        {!insights && !insightsLoading && (
          <div className="px-5 py-5 bg-[#0D0D0D] border border-[#1C1C1C] rounded-lg">
            <p className="text-xs text-[#333] font-mono leading-relaxed">
              Groq AI (LLaMA 3.3 70B) will analyze your exact browsing patterns — context switches, focus streaks,
              distraction costs — and give you a personalized action plan.
            </p>
          </div>
        )}
      </div>

    </motion.div>
  );
}
