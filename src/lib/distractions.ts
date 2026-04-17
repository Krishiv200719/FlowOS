// ═══════════════════════════════════════════════════════════
// FlowOS — Distraction Domain List
// ═══════════════════════════════════════════════════════════

export const DISTRACTION_DOMAINS: string[] = [
  'youtube.com',
  'instagram.com',
  'twitter.com',
  'x.com',
  'facebook.com',
  'tiktok.com',
  'reddit.com',
  'netflix.com',
  'snapchat.com',
  'web.whatsapp.com',
  'linkedin.com',
  'news.ycombinator.com',
  'buzzfeed.com',
  '9gag.com',
  'twitch.tv',
  'pinterest.com',
  'tumblr.com',
];

export function isDistraction(url: string): boolean {
  return DISTRACTION_DOMAINS.some((domain) => url.includes(domain));
}

/** Get the color for a distraction domain (consistent across charts) */
export function getDistractorColor(domain: string): string {
  const colors: Record<string, string> = {
    'youtube.com': '#FF0000',
    'twitter.com': '#1DA1F2',
    'x.com': '#1DA1F2',
    'reddit.com': '#FF5700',
    'instagram.com': '#E1306C',
    'facebook.com': '#1877F2',
    'tiktok.com': '#69C9D0',
    'netflix.com': '#E50914',
    'twitch.tv': '#9146FF',
  };
  return colors[domain] || '#888888';
}
