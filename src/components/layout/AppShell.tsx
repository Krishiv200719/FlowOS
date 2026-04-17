import { type ReactNode } from 'react';
import Sidebar from './Sidebar';
import { useSessionContext } from '../../context/SessionContext';

interface AppShellProps {
  children: ReactNode;
}

export default function AppShell({ children }: AppShellProps) {
  const { extensionConnected } = useSessionContext();

  return (
    <div className="min-h-screen bg-flow-bg">
      {/* POLISH #1: Demo mode top border + badge */}
      {!extensionConnected && (
        <>
          <div
            style={{
              height: '2px',
              background: 'linear-gradient(90deg, #00F5FF, #00D46A, #00F5FF)',
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              zIndex: 1000,
            }}
          />
          <div
            style={{
              position: 'fixed',
              top: '8px',
              right: '12px',
              zIndex: 1001,
              background: 'rgba(0,245,255,0.08)',
              border: '1px solid rgba(0,245,255,0.25)',
              borderRadius: '4px',
              padding: '2px 8px',
              fontSize: '9px',
              fontFamily: "'JetBrains Mono', monospace",
              color: '#00F5FF',
              letterSpacing: '2px',
            }}
          >
            DEMO DATA
          </div>
        </>
      )}

      <Sidebar />
      <main className="ml-[220px] min-h-screen" style={{ paddingTop: !extensionConnected ? '2px' : 0 }}>
        <div className="max-w-5xl mx-auto px-8 py-8">
          {children}
        </div>
      </main>
    </div>
  );
}
