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
import { mockSessions as MOCK_SESSIONS } from '../data/mockSessions';

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

          // DEMO FIX: Merge real sessions + mock sessions.
          // Real sessions rendered at top; mocks fill out history.
          // Dedup by ID so no duplicates if mock IDs overlap.
          const realIds = new Set(extSessions.map((s) => s.id));
          const mockFill = MOCK_SESSIONS.filter((s) => !realIds.has(s.id));
          const merged = [...extSessions, ...mockFill].sort(
            (a, b) => b.startTime - a.startTime
          );
          setSessions(merged);
          console.log(
            `[FlowOS] ${extSessions.length} real + ${mockFill.length} mock sessions merged.`
          );
        } else {
          // Extension connected but no sessions yet — use mock data as seed
          setSessions(MOCK_SESSIONS);
          console.log('[FlowOS] Extension connected, no sessions yet — showing mock data.');
        }
      } else {
        // No extension — always fall back to mock data for demo
        setSessions(MOCK_SESSIONS);
        console.log('[FlowOS] No extension detected — using mock demo data.');
      }
    } catch (err) {
      console.warn('[FlowOS] Bridge error:', err);
      // On any error, fall back to mock data so the app never goes blank
      setSessions(MOCK_SESSIONS);
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
