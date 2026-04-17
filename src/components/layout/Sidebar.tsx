import { NavLink } from 'react-router-dom';
import { useSessionContext } from '../../context/SessionContext';

const navItems = [
  { path: '/', label: 'Home', icon: '🏠' },
  { path: '/mirror', label: 'Last Session', icon: '🪞' },
  { path: '/dna', label: 'Focus DNA', icon: '🧬' },
  { path: '/history', label: 'History', icon: '📋' },
];

export default function Sidebar() {
  const { extensionConnected, sessions, refresh } = useSessionContext();

  return (
    <aside className="fixed left-0 top-0 bottom-0 w-[220px] bg-flow-bg-secondary border-r border-flow-border flex flex-col z-50">
      {/* Logo */}
      <div className="px-5 pt-6 pb-4">
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
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === '/'}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-all duration-200 ${
                isActive
                  ? 'bg-flow-elevated text-flow-cyan shadow-glow-cyan'
                  : 'text-flow-muted hover:text-white hover:bg-flow-card'
              }`
            }
          >
            <span className="text-base">{item.icon}</span>
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="h-px bg-flow-border mx-4" />

      {/* Footer — Extension Status */}
      <div className="px-5 py-4 space-y-3">
        <div className="flex items-center gap-2">
          <div
            className={`w-2 h-2 rounded-full ${
              extensionConnected ? 'bg-flow-green animate-pulse' : 'bg-flow-muted'
            }`}
          />
          <span className="text-xs text-flow-muted">
            {extensionConnected ? 'Extension Connected' : 'Extension Not Detected'}
          </span>
        </div>

        {extensionConnected && (
          <p className="text-[10px] text-flow-very-muted font-mono">
            {sessions.length} session{sessions.length !== 1 ? 's' : ''} recorded
          </p>
        )}

        {extensionConnected && (
          <button
            onClick={refresh}
            className="text-[10px] font-mono text-flow-cyan hover:text-white transition-colors"
          >
            ↻ Refresh Data
          </button>
        )}

        <p className="text-[10px] text-flow-very-muted leading-relaxed">
          🔒 Your data never leaves your device
        </p>
      </div>
    </aside>
  );
}
