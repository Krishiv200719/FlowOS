// ═══════════════════════════════════════════════════════════
// FlowOS — Session Context
// Single source of truth for session data across all screens.
// Loads ONLY from the extension bridge — no mock/hardcoded data.
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
          console.log(
            `[FlowOS] Loaded ${extSessions.length} real sessions from extension.`
          );
        } else {
          setSessions([]);
          console.log('[FlowOS] Extension connected — no sessions yet.');
        }
      } else {
        setSessions([]);
        console.log('[FlowOS] No extension detected.');
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
