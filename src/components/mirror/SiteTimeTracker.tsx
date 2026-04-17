// ═══════════════════════════════════════════════════════════
// FlowOS — Site Time Tracker
// Feature 3e: ranked list of sites visited this/all sessions
// ═══════════════════════════════════════════════════════════

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getSiteLog, clearGlobalSiteLog } from '../../lib/bridge';

interface SiteEntry {
  domain: string;
  totalMs: number;
  visits: number;
  category: string;
  lastVisited?: number;
}

function formatDuration(ms: number): string {
  const totalSec = Math.round(ms / 1000);
  if (totalSec < 60) return `${totalSec}s`;
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

function categoryColor(category: string): { bar: string; badge: string; text: string } {
  switch (category) {
    case 'distraction':
      return {
        bar: '#FF3B3B',
        badge: 'rgba(255,59,59,0.12)',
        text: '#FF3B3B',
      };
    case 'work':
      return {
        bar: '#00D46A',
        badge: 'rgba(0,212,106,0.12)',
        text: '#00D46A',
      };
    default:
      return {
        bar: '#F59E0B',
        badge: 'rgba(245,158,11,0.12)',
        text: '#F59E0B',
      };
  }
}

function categoryLabel(category: string): string {
  switch (category) {
    case 'distraction': return 'DISTRACTION';
    case 'work': return 'WORK';
    default: return 'NEUTRAL';
  }
}

interface SiteTimeTrackerProps {
  /** If provided, shows this session's siteLog without a bridge call */
  inlineSiteLog?: Record<string, { totalMs: number; visits: number; category: string }>;
}

export default function SiteTimeTracker({ inlineSiteLog }: SiteTimeTrackerProps) {
  const [view, setView] = useState<'session' | 'alltime'>('session');
  const [sessionSites, setSessionSites] = useState<SiteEntry[]>([]);
  const [globalSites, setGlobalSites] = useState<SiteEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [clearing, setClearing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getSiteLog();

      // Build session list (prefer inlineSiteLog if given so Mirror works offline)
      const sourceLog = inlineSiteLog ?? result.siteLog;
      const sessionList: SiteEntry[] = Object.entries(sourceLog)
        .map(([domain, v]) => ({ domain, ...v }))
        .filter(e => e.totalMs > 0)
        .sort((a, b) => b.totalMs - a.totalMs);

      const globalList: SiteEntry[] = Object.entries(result.globalSiteLog)
        .map(([domain, v]) => ({ domain, ...v }))
        .filter(e => e.totalMs > 0)
        .sort((a, b) => b.totalMs - a.totalMs);

      setSessionSites(sessionList);
      setGlobalSites(globalList);
    } catch {
      // Extension not connected or no data yet — show empty state
      if (inlineSiteLog) {
        const sessionList: SiteEntry[] = Object.entries(inlineSiteLog)
          .map(([domain, v]) => ({ domain, ...v }))
          .filter(e => e.totalMs > 0)
          .sort((a, b) => b.totalMs - a.totalMs);
        setSessionSites(sessionList);
      }
    } finally {
      setLoading(false);
    }
  }, [inlineSiteLog]);

  useEffect(() => { load(); }, [load]);

  const sites = view === 'session' ? sessionSites : globalSites;
  const maxMs = sites[0]?.totalMs ?? 1;

  async function handleClear() {
    setClearing(true);
    try {
      await clearGlobalSiteLog();
      setGlobalSites([]);
    } catch {}
    setClearing(false);
  }

  return (
    <div
      style={{
        background: 'rgba(255,255,255,0.02)',
        border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: '10px',
        padding: '20px 24px',
      }}
    >
      {/* Header + Toggle */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <p
          style={{
            fontSize: '10px',
            fontFamily: "'JetBrains Mono', monospace",
            letterSpacing: '2px',
            color: '#555',
            textTransform: 'uppercase',
          }}
        >
          Site Time Tracker
        </p>

        <div
          style={{
            display: 'flex',
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '6px',
            overflow: 'hidden',
            fontSize: '9px',
            fontFamily: "'JetBrains Mono', monospace",
          }}
        >
          {(['session', 'alltime'] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              style={{
                padding: '4px 12px',
                border: 'none',
                cursor: 'pointer',
                background: view === v ? 'rgba(0,245,255,0.1)' : 'transparent',
                color: view === v ? '#00F5FF' : '#555',
                letterSpacing: '1px',
                textTransform: 'uppercase',
                transition: 'all 0.15s',
              }}
            >
              {v === 'session' ? 'This Session' : 'All Time'}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {[1, 2, 3].map(i => (
            <div key={i} className="skeleton" style={{ height: '36px', borderRadius: '6px' }} />
          ))}
        </div>
      ) : sites.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '32px 0' }}>
          <p style={{ fontSize: '12px', color: '#333', fontFamily: "'JetBrains Mono', monospace" }}>
            {view === 'session' ? 'No site data for this session.' : 'No browsing history recorded yet.'}
          </p>
        </div>
      ) : (
        <AnimatePresence mode="wait">
          <motion.div
            key={view}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}
          >
            {sites.slice(0, 12).map((site, i) => {
              const colors = categoryColor(site.category);
              const widthPct = (site.totalMs / maxMs) * 100;

              return (
                <motion.div
                  key={site.domain}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.04 }}
                  style={{ display: 'flex', alignItems: 'center', gap: '10px' }}
                >
                  {/* Rank */}
                  <span
                    style={{
                      fontSize: '9px',
                      fontFamily: "'JetBrains Mono', monospace",
                      color: '#333',
                      width: '14px',
                      textAlign: 'right',
                      flexShrink: 0,
                    }}
                  >
                    {i + 1}
                  </span>

                  {/* Favicon */}
                  <img
                    src={`https://www.google.com/s2/favicons?domain=${site.domain}&sz=16`}
                    alt=""
                    width={14}
                    height={14}
                    style={{ borderRadius: '2px', flexShrink: 0, opacity: 0.8 }}
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />

                  {/* Domain + bar */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '3px' }}>
                      <span
                        style={{
                          fontSize: '11px',
                          color: '#CCC',
                          fontFamily: "'JetBrains Mono', monospace",
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          maxWidth: '160px',
                        }}
                      >
                        {site.domain}
                      </span>
                      <span
                        style={{
                          fontSize: '10px',
                          fontFamily: "'JetBrains Mono', monospace",
                          color: '#999',
                          marginLeft: '8px',
                          flexShrink: 0,
                        }}
                      >
                        {formatDuration(site.totalMs)}
                      </span>
                    </div>

                    {/* Progress bar */}
                    <div
                      style={{
                        height: '3px',
                        background: 'rgba(255,255,255,0.05)',
                        borderRadius: '2px',
                        overflow: 'hidden',
                      }}
                    >
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${widthPct}%` }}
                        transition={{ duration: 0.6, delay: i * 0.04, ease: 'easeOut' }}
                        style={{
                          height: '100%',
                          background: colors.bar,
                          borderRadius: '2px',
                          opacity: 0.8,
                        }}
                      />
                    </div>
                  </div>

                  {/* Category badge */}
                  <span
                    style={{
                      fontSize: '8px',
                      fontFamily: "'JetBrains Mono', monospace",
                      letterSpacing: '1px',
                      color: colors.text,
                      background: colors.badge,
                      padding: '2px 6px',
                      borderRadius: '3px',
                      flexShrink: 0,
                    }}
                  >
                    {categoryLabel(site.category)}
                  </span>
                </motion.div>
              );
            })}
          </motion.div>
        </AnimatePresence>
      )}

      {/* Clear All Time button */}
      {view === 'alltime' && globalSites.length > 0 && (
        <div style={{ marginTop: '16px', textAlign: 'right' }}>
          <button
            onClick={handleClear}
            disabled={clearing}
            style={{
              background: 'none',
              border: '1px dashed #333',
              borderRadius: '4px',
              color: '#555',
              fontSize: '9px',
              fontFamily: "'JetBrains Mono', monospace",
              padding: '4px 10px',
              cursor: clearing ? 'not-allowed' : 'pointer',
              letterSpacing: '1px',
            }}
          >
            {clearing ? 'CLEARING...' : 'CLEAR ALL TIME DATA'}
          </button>
        </div>
      )}
    </div>
  );
}
