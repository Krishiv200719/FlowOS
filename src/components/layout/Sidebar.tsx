import { NavLink, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useSessionContext } from '../../context/SessionContext';

const navItems = [
  { path: '/', label: 'Home', icon: '🏠' },
  { path: '/mirror', label: 'Last Session', icon: '🪞' },
  { path: '/dna', label: 'Focus DNA', icon: '🧬' },
  { path: '/history', label: 'History', icon: '📋' },
];

// UPGRADE #8: Keyboard shortcut cheatsheet modal
function ShortcutModal({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-[200] flex items-end justify-start pb-6 pl-6"
      onClick={onClose}
    >
      <div
        className="bg-[#111111] border border-[#2A2A2A] rounded-lg p-4 shadow-2xl w-56"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-[10px] font-mono uppercase tracking-widest text-flow-cyan mb-3">
          Keyboard Shortcuts
        </p>
        {[
          ['1', 'Home'],
          ['2', 'Last Session'],
          ['3', 'Focus DNA'],
          ['4', 'History'],
          ['N', 'New Session'],
          ['?', 'This panel'],
        ].map(([key, label]) => (
          <div key={key} className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-mono text-flow-muted">{label}</span>
            <kbd className="text-[9px] font-mono text-white bg-[#1C1C1C] border border-[#333] rounded px-1.5 py-0.5">
              {key}
            </kbd>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Sidebar() {
  const { extensionConnected, sessions, refresh } = useSessionContext();
  const navigate = useNavigate();
  const [showShortcuts, setShowShortcuts] = useState(false);

  // Computed stats
  const totalFocusMin = Math.round(
    sessions.reduce((sum, s) => sum + s.stats.realFocusTime / 60000, 0)
  );
  const bestRatio =
    sessions.length > 0
      ? Math.max(...sessions.map((s) => Math.round(s.stats.focusRatio * 100)))
      : 0;

  // Today's best
  const today = new Date();
  const todayKey = `${today.getFullYear()}-${today.getMonth()}-${today.getDate()}`;
  const todaySessions = sessions.filter((s) => {
    const d = new Date(s.startTime);
    return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}` === todayKey;
  });
  const todayBest =
    todaySessions.length > 0
      ? Math.max(...todaySessions.map((s) => Math.round(s.stats.focusRatio * 100)))
      : null;

  // Last session drama
  const lastSession =
    sessions.length > 0
      ? sessions.reduce((a, b) => (a.startTime > b.startTime ? a : b))
      : null;
  const lastRatio = lastSession ? lastSession.stats.focusRatio : 1;

  // UPGRADE #8: Global keyboard handling at sidebar level for shortcuts modal
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === '?') setShowShortcuts((v) => !v);
      if (e.key === 'Escape') setShowShortcuts(false);
      if (e.key === '1') navigate('/');
      if (e.key === '2') navigate('/mirror');
      if (e.key === '3') navigate('/dna');
      if (e.key === '4') navigate('/history');
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [navigate]);

  return (
    <>
      <aside className="fixed left-0 top-0 bottom-0 w-[220px] bg-flow-bg-secondary border-r border-flow-border flex flex-col z-50">
        {/* DESIGN #5: Scanline logo area */}
        <div className="px-5 pt-6 pb-4 relative overflow-hidden">
          <div className="logo-scanline" />
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-md bg-gradient-to-br from-flow-cyan to-flow-green flex items-center justify-center text-sm font-bold text-flow-bg">
              F
            </div>
            <h1 className="text-lg font-bold tracking-tight">
              Flow<span className="text-flow-cyan">OS</span>
            </h1>
          </div>
          <p className="text-[10px] text-flow-very-muted font-mono mt-2 tracking-wider uppercase">
            Focus Operating System
          </p>
        </div>

        <div className="h-px bg-flow-border mx-4" />

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map((item) => {
            const showWarning =
              item.path === '/mirror' && lastSession && lastRatio < 0.4;

            return (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.path === '/'}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-all duration-200 ${
                    isActive
                      ? 'bg-flow-elevated text-flow-cyan'
                      : 'text-flow-muted hover:text-white hover:bg-flow-card'
                  }`
                }
                style={({ isActive }) =>
                  isActive ? { boxShadow: '0 0 0 1px rgba(0,245,255,0.2), 0 0 12px rgba(0,245,255,0.08)' } : {}
                }
              >
                <span className="text-base">{item.icon}</span>
                <span className="flex-1">{item.label}</span>
                {/* UPGRADE #5: Warning badge on Last Session when focus < 40% */}
                {showWarning && (
                  <span className="text-flow-red text-xs">⚠</span>
                )}
              </NavLink>
            );
          })}
        </nav>

        <div className="h-px bg-flow-border mx-4" />

        {/* Footer */}
        <div className="px-5 py-4 space-y-3">
          <div className="flex items-center gap-2">
            <div
              className={`w-2 h-2 rounded-full ${
                extensionConnected ? 'bg-flow-green animate-pulse' : 'bg-flow-muted'
              }`}
            />
            <span className="text-xs text-flow-muted">
              {extensionConnected ? 'Extension Connected' : 'Demo Mode'}
            </span>
          </div>

          {extensionConnected && (
            <button
              onClick={refresh}
              className="text-[10px] font-mono text-flow-cyan hover:text-white transition-colors"
            >
              ↻ Refresh Data
            </button>
          )}

          {/* UPGRADE #5: Today's best stat */}
          <div className="space-y-1">
            <p className="text-[9px] font-mono text-flow-very-muted uppercase tracking-wider">
              Quick Stats
            </p>
            <div className="grid grid-cols-2 gap-x-2 gap-y-0.5">
              <span className="text-[9px] font-mono text-flow-very-muted">Sessions</span>
              <span className="text-[9px] font-mono text-flow-muted text-right">{sessions.length}</span>
              <span className="text-[9px] font-mono text-flow-very-muted">Focus time</span>
              <span className="text-[9px] font-mono text-flow-muted text-right">
                {Math.floor(totalFocusMin / 60)}h {totalFocusMin % 60}m
              </span>
              <span className="text-[9px] font-mono text-flow-very-muted">Best ratio</span>
              <span className="text-[9px] font-mono text-flow-green text-right">{bestRatio}%</span>
              <span className="text-[9px] font-mono text-flow-very-muted">Today best</span>
              <span
                className="text-[9px] font-mono text-right"
                style={{
                  color: todayBest === null ? '#555' : todayBest > 60 ? '#00D46A' : todayBest > 40 ? '#FF6B35' : '#FF3B3B',
                }}
              >
                {todayBest !== null ? `${todayBest}%` : '—'}
              </span>
            </div>
          </div>

          <p className="text-[9px] text-flow-very-muted leading-relaxed">
            🔒 Data never leaves your device
          </p>

          {/* UPGRADE #8: Shortcut hint */}
          <button
            onClick={() => setShowShortcuts((v) => !v)}
            className="text-[9px] font-mono text-flow-very-muted hover:text-flow-muted transition-colors"
          >
            ? keyboard shortcuts
          </button>
        </div>
      </aside>

      {showShortcuts && <ShortcutModal onClose={() => setShowShortcuts(false)} />}
    </>
  );
}
