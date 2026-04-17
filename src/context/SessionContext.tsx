// ═══════════════════════════════════════════════════════════
// FlowOS — Session Context
// Single source of truth for session data across all screens.
// Falls back to mock data when extension is not connected.
// ═══════════════════════════════════════════════════════════

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react';
import type { FocusSession } from '../types';
import { isExtensionConnected, getExtensionSessions } from '../lib/bridge';
import { mockSessions as MOCK } from '../data/mockSessions';

interface SessionContextValue {
  sessions: FocusSession[];
  loading: boolean;
  extensionConnected: boolean;
  refresh: () => Promise<void>;
}

const SessionContext = createContext<SessionContextValue>({
  sessions: [],
  loading: true,
  extensionConnected: false,
  refresh: async () => {},
});

export function SessionProvider({ children }: { children: ReactNode }) {
  const [sessions, setSessions] = useState<FocusSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [extensionConnected, setExtensionConnected] = useState(false);

  const loadSessions = useCallback(async () => {
    setLoading(true);
    try {
      const connected = await isExtensionConnected();
      setExtensionConnected(connected);

      if (connected) {
        const extSessions = await getExtensionSessions();
        if (extSessions && extSessions.length > 0) {
          extSessions.sort((a, b) => b.startTime - a.startTime);
          setSessions(extSessions);
          console.log(`[FlowOS] ${extSessions.length} real sessions loaded from extension.`);
        } else {
          // Extension connected but no sessions yet — show mock for demo
          setSessions(MOCK);
          console.log('[FlowOS] Extension connected but no sessions yet — using mock data.');
        }
      } else {
        // No extension — always show mock data so app is never blank
        setSessions(MOCK);
        console.log('[FlowOS] Extension not detected — using mock data.');
      }
    } catch (err) {
      console.warn('[FlowOS] Bridge error, using mock data:', err);
      setSessions(MOCK);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(loadSessions, 400);
    return () => clearTimeout(timer);
  }, [loadSessions]);

  return (
    <SessionContext.Provider
      value={{ sessions, loading, extensionConnected, refresh: loadSessions }}
    >
      {children}
    </SessionContext.Provider>
  );
}

export function useSessionContext() {
  return useContext(SessionContext);
}
