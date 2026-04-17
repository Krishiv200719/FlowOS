// ═══════════════════════════════════════════════════════════
// FlowOS — computeSiteLog
// Derives per-domain time from session events.
// Mirrors background.js computeSiteLogFromEvents exactly.
// Used by Mirror.tsx so SiteTimeTracker always has data.
// ═══════════════════════════════════════════════════════════

import type { SessionEvent, SiteLogEntry } from '../types';

const DISTRACTION_DOMAINS = [
  'youtube.com', 'instagram.com', 'twitter.com', 'x.com',
  'facebook.com', 'tiktok.com', 'reddit.com', 'netflix.com',
  'snapchat.com', 'web.whatsapp.com', 'linkedin.com',
  'news.ycombinator.com', 'buzzfeed.com', '9gag.com',
  'twitch.tv', 'pinterest.com', 'tumblr.com',
];

export function computeSiteLog(
  events: SessionEvent[]
): Record<string, SiteLogEntry> {
  const log: Record<string, SiteLogEntry> = {};

  for (const event of events) {
    if (!event.domain || event.domain === 'unknown') continue;
    if (event.type !== 'focus' && event.type !== 'distraction') continue;
    const dur = event.duration ?? 0;
    if (dur <= 0) continue;

    const category: SiteLogEntry['category'] = DISTRACTION_DOMAINS.some(d =>
      event.domain!.includes(d)
    ) ? 'distraction' : 'work';

    if (!log[event.domain]) {
      log[event.domain] = { totalMs: 0, visits: 0, category };
    }
    log[event.domain].totalMs += dur;
    log[event.domain].visits += 1;
  }

  return log;
}
