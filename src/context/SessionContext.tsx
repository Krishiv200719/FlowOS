// ═══════════════════════════════════════════════════════════
// FlowOS — Session Context
// Single source of truth for session data across all screens.
// Always uses REAL data from the extension only.
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
          // Extension connected but no sessions recorded yet
          setSessions([]);
          console.log('[FlowOS] Extension connected — no sessions yet.');
        }
      } else {
        // Extension not installed / not connected
        setSessions([]);
        console.log('[FlowOS] Extension not detected.');
      }
    } catch (err) {
      console.warn('[FlowOS] Bridge error:', err);
      setSessions([]);
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
