// ═══════════════════════════════════════════════════════════
// FlowOS — IndexedDB Storage (via idb)
// ═══════════════════════════════════════════════════════════

import { openDB, type DBSchema } from 'idb';
import type { FocusSession, AIInsights } from '../types';

interface FlowOSDB extends DBSchema {
  sessions: {
    key: string;
    value: FocusSession;
    indexes: { 'by-start': number };
  };
  insights: {
    key: string;
    value: AIInsights & { id: string; timestamp: number };
  };
}

const DB_NAME = 'flowos-db';
const DB_VERSION = 1;

async function getDB() {
  return openDB<FlowOSDB>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      const sessionStore = db.createObjectStore('sessions', { keyPath: 'id' });
      sessionStore.createIndex('by-start', 'startTime');

      db.createObjectStore('insights', { keyPath: 'id' });
    },
  });
}

export async function saveSession(session: FocusSession): Promise<void> {
  const db = await getDB();
  await db.put('sessions', session);
}

export async function getAllSessions(): Promise<FocusSession[]> {
  const db = await getDB();
  const sessions = await db.getAll('sessions');
  return sessions.sort((a, b) => b.startTime - a.startTime);
}

export async function getSession(id: string): Promise<FocusSession | undefined> {
  const db = await getDB();
  return db.get('sessions', id);
}

export async function deleteSession(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('sessions', id);
}

export async function saveInsights(insights: AIInsights): Promise<void> {
  const db = await getDB();
  await db.put('insights', {
    ...insights,
    id: 'latest',
    timestamp: Date.now(),
  });
}

export async function getInsights(): Promise<AIInsights | undefined> {
  const db = await getDB();
  const record = await db.get('insights', 'latest');
  if (!record) return undefined;
  const { id: _id, timestamp: _ts, ...insights } = record;
  return insights as AIInsights;
}
