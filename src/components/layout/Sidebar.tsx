import { NavLink, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useSessionContext } from '../../context/SessionContext';

const navItems = [
  { path: '/',        label: 'Home',           abbr: '01' },
  { path: '/mirror',  label: 'Last Session',    abbr: '02' },
  { path: '/dna',     label: 'Focus DNA',       abbr: '03' },
  { path: '/history', label: 'History',         abbr: '04' },
  { path: '/activity',label: 'Last 2 Hours',    abbr: '05' },
];

function ShortcutModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[200] flex items-end justify-start pb-6 pl-6" onClick={onClose}>
      <div className="bg-[#111111] border border-[#2A2A2A] rounded-lg p-4 shadow-2xl w-56" onClick={(e) => e.stopPropagation()}>
        <p className="text-[10px] font-mono uppercase tracking-widest text-flow-cyan mb-3">Keyboard Shortcuts</p>
        {[ ['1', 'Home'], ['2', 'Last Session'], ['3', 'Focus DNA'], ['4', 'History'], ['N', 'New Session'], ['?', 'This panel'] ].map(([key, label]) => (
          <div key={key} className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-mono text-flow-muted">{label}</span>
            <kbd className="text-[9px] font-mono text-white bg-[#1C1C1C] border border-[#333] rounded px-1.5 py-0.5">{key}</kbd>
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

  const totalFocusMin = Math.round(sessions.reduce((sum, s) => sum + s.stats.realFocusTime / 60000, 0));
  const bestRatio = sessions.length > 0 ? Math.max(...sessions.map(s => Math.round(s.stats.focusRatio * 100))) : 0;

  const today = new Date();
  const todayKey = `${today.getFullYear()}-${today.getMonth()}-${today.getDate()}`;
  const todaySessions = sessions.filter(s => {
    const d = new Date(s.startTime);
    return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}` === todayKey;
  });
  const todayBest = todaySessions.length > 0
    ? Math.max(...todaySessions.map(s => Math.round(s.stats.focusRatio * 100))) : null;

  const lastSession = sessions.length > 0 ? sessions.reduce((a, b) => a.startTime > b.startTime ? a : b) : null;
  const lastRatio = lastSession ? lastSession.stats.focusRatio : 1;

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === '?') setShowShortcuts(v => !v);
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
      <aside className="fixed left-0 top-0 bottom-0 w-[220px] bg-[#080808] border-r border-[#1A1A1A] flex flex-col z-50">
        {/* Logo */}
        <div className="px-5 pt-7 pb-5">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded bg-flow-cyan flex items-center justify-center">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M7 1L13 7L7 13M1 7H13" stroke="#080808" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <span className="text-[15px] font-bold tracking-tight">Flow<span className="text-flow-cyan">OS</span></span>
          </div>
          <p className="text-[9px] text-[#444] font-mono mt-2 tracking-[0.15em] uppercase">Focus Operating System</p>
        </div>

        <div className="h-px bg-[#1A1A1A] mx-5" />

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5">
          {navItems.map(item => {
            const showWarn = item.path === '/mirror' && lastSession && lastRatio < 0.4;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.path === '/'}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded text-sm transition-all duration-150 ${
                    isActive
                      ? 'bg-[#111] text-white border border-[#222]'
                      : 'text-[#555] hover:text-[#AAA] hover:bg-[#0D0D0D]'
                  }`
                }
              >
                <span className={`text-[9px] font-mono`}>{item.abbr}</span>
                <span className="flex-1 font-medium">{item.label}</span>
                {showWarn && (
                  <span className="w-1.5 h-1.5 rounded-full bg-flow-red" />
                )}
              </NavLink>
            );
          })}
        </nav>

        <div className="h-px bg-[#1A1A1A] mx-5" />

        {/* Footer */}
        <div className="px-5 py-4 space-y-3">
          <div className="flex items-center gap-2">
            <div className={`w-1.5 h-1.5 rounded-full ${extensionConnected ? 'bg-flow-green' : 'bg-[#333]'}`} />
            <span className="text-[11px] text-[#555]">{extensionConnected ? 'Extension active' : 'Demo mode'}</span>
          </div>

          {extensionConnected && (
            <button onClick={refresh} className="text-[10px] font-mono text-[#444] hover:text-flow-cyan transition-colors">
              Refresh data
            </button>
          )}

          <div className="space-y-1 pt-1">
            <p className="text-[9px] font-mono text-[#333] uppercase tracking-wider mb-2">Stats</p>
            {[
              ['Sessions', sessions.length.toString()],
              ['Focus time', `${Math.floor(totalFocusMin / 60)}h ${totalFocusMin % 60}m`],
              ['Best ratio', `${bestRatio}%`],
              ['Today best', todayBest !== null ? `${todayBest}%` : '—'],
            ].map(([label, value]) => (
              <div key={label} className="flex items-center justify-between">
                <span className="text-[9px] font-mono text-[#333]">{label}</span>
                <span className="text-[9px] font-mono text-[#555]">{value}</span>
              </div>
            ))}
          </div>

          <button
            onClick={() => setShowShortcuts(v => !v)}
            className="text-[9px] font-mono text-[#2A2A2A] hover:text-[#444] transition-colors"
          >
            ? shortcuts
          </button>
        </div>
      </aside>
      {showShortcuts && <ShortcutModal onClose={() => setShowShortcuts(false)} />}
    </>
  );
}
