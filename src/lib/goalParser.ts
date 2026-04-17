// ═══════════════════════════════════════════════════════════
// FlowOS — Natural Language Goal Parser
// Extracts a website domain from a plain-English goal string.
// "watching youtube" → "youtube.com"
// "focus on notion" → "notion.so"
// ═══════════════════════════════════════════════════════════

export interface ParsedGoal {
  detectedDomain: string | null;
  detectedSiteName: string | null;
  confidence: 'high' | 'medium' | 'none';
}

const SITE_MAP: Array<{ keywords: string[]; domain: string; name: string }> = [
  { keywords: ['youtube', 'yt', 'watch video', 'watching video', 'watching yt', 'watch yt'], domain: 'youtube.com', name: 'YouTube' },
  { keywords: ['netflix', 'watching netflix'], domain: 'netflix.com', name: 'Netflix' },
  { keywords: ['twitch', 'stream', 'streaming'], domain: 'twitch.tv', name: 'Twitch' },
  { keywords: ['vimeo'], domain: 'vimeo.com', name: 'Vimeo' },
  { keywords: ['prime video', 'amazon prime'], domain: 'primevideo.com', name: 'Prime Video' },
  { keywords: ['notion', 'notion page', 'notion doc'], domain: 'notion.so', name: 'Notion' },
  { keywords: ['obsidian'], domain: 'obsidian.md', name: 'Obsidian' },
  { keywords: ['evernote'], domain: 'evernote.com', name: 'Evernote' },
  { keywords: ['github', 'git hub', 'pull request', 'pr review', 'code review'], domain: 'github.com', name: 'GitHub' },
  { keywords: ['gitlab'], domain: 'gitlab.com', name: 'GitLab' },
  { keywords: ['stackoverflow', 'stack overflow'], domain: 'stackoverflow.com', name: 'Stack Overflow' },
  { keywords: ['leetcode', 'leet code', 'coding problem', 'dsa', 'algorithms'], domain: 'leetcode.com', name: 'LeetCode' },
  { keywords: ['hackerrank', 'hacker rank'], domain: 'hackerrank.com', name: 'HackerRank' },
  { keywords: ['codepen'], domain: 'codepen.io', name: 'CodePen' },
  { keywords: ['replit', 'repl'], domain: 'replit.com', name: 'Replit' },
  { keywords: ['linear'], domain: 'linear.app', name: 'Linear' },
  { keywords: ['jira'], domain: 'jira.atlassian.com', name: 'Jira' },
  { keywords: ['trello'], domain: 'trello.com', name: 'Trello' },
  { keywords: ['asana'], domain: 'asana.com', name: 'Asana' },
  { keywords: ['figma', 'figma design', 'designing in figma'], domain: 'figma.com', name: 'Figma' },
  { keywords: ['canva'], domain: 'canva.com', name: 'Canva' },
  { keywords: ['framer'], domain: 'framer.com', name: 'Framer' },
  { keywords: ['adobe', 'photoshop', 'illustrator'], domain: 'adobe.com', name: 'Adobe' },
  { keywords: ['dribbble'], domain: 'dribbble.com', name: 'Dribbble' },
  { keywords: ['google docs', 'gdocs', 'writing doc'], domain: 'docs.google.com', name: 'Google Docs' },
  { keywords: ['google sheets', 'sheets', 'spreadsheet'], domain: 'sheets.google.com', name: 'Google Sheets' },
  { keywords: ['google slides', 'slides', 'presentation'], domain: 'slides.google.com', name: 'Google Slides' },
  { keywords: ['google drive', 'gdrive', 'drive'], domain: 'drive.google.com', name: 'Google Drive' },
  { keywords: ['airtable'], domain: 'airtable.com', name: 'Airtable' },
  { keywords: ['confluence'], domain: 'confluence.atlassian.com', name: 'Confluence' },
  { keywords: ['coursera', 'course'], domain: 'coursera.org', name: 'Coursera' },
  { keywords: ['udemy'], domain: 'udemy.com', name: 'Udemy' },
  { keywords: ['edx'], domain: 'edx.org', name: 'edX' },
  { keywords: ['khan academy', 'khanacademy'], domain: 'khanacademy.org', name: 'Khan Academy' },
  { keywords: ['duolingo', 'language learning'], domain: 'duolingo.com', name: 'Duolingo' },
  { keywords: ['brilliant'], domain: 'brilliant.org', name: 'Brilliant' },
  { keywords: ['skillshare'], domain: 'skillshare.com', name: 'Skillshare' },
  { keywords: ['arxiv', 'research paper'], domain: 'arxiv.org', name: 'arXiv' },
  { keywords: ['wikipedia', 'wiki'], domain: 'wikipedia.org', name: 'Wikipedia' },
  { keywords: ['medium'], domain: 'medium.com', name: 'Medium' },
  { keywords: ['substack'], domain: 'substack.com', name: 'Substack' },
  { keywords: ['hacker news', 'hackernews', 'hn'], domain: 'news.ycombinator.com', name: 'Hacker News' },
  { keywords: ['gmail', 'email', 'inbox'], domain: 'gmail.com', name: 'Gmail' },
  { keywords: ['outlook'], domain: 'outlook.com', name: 'Outlook' },
  { keywords: ['slack'], domain: 'slack.com', name: 'Slack' },
  { keywords: ['discord'], domain: 'discord.com', name: 'Discord' },
  { keywords: ['twitter', 'tweets', 'tweeting'], domain: 'twitter.com', name: 'Twitter/X' },
  { keywords: ['reddit'], domain: 'reddit.com', name: 'Reddit' },
  { keywords: ['instagram'], domain: 'instagram.com', name: 'Instagram' },
  { keywords: ['linkedin'], domain: 'linkedin.com', name: 'LinkedIn' },
  { keywords: ['amazon', 'shopping on amazon'], domain: 'amazon.com', name: 'Amazon' },
  { keywords: ['shopify'], domain: 'shopify.com', name: 'Shopify' },
];

const ALLOWLIST_VERBS = [
  'watch', 'watching', 'study on', 'studying on', 'using', 'use',
  'focus on', 'working on', 'working in', 'read on', 'reading on',
  'browse', 'browsing', 'practice on', 'learn on', 'learning on',
  'course on', 'training on', 'design in', 'designing in', 'code on',
  'coding on', 'build on', 'building on',
];

/**
 * Parse a natural language goal and detect if it references a website.
 * "watching youtube" → { detectedDomain: "youtube.com", detectedSiteName: "YouTube", confidence: "high" }
 */
export function parseGoalForDomain(goalText: string): ParsedGoal {
  if (!goalText || goalText.trim().length < 3) {
    return { detectedDomain: null, detectedSiteName: null, confidence: 'none' };
  }

  const lower = goalText.toLowerCase().trim();

  // Step 1: Direct domain typing (notion.so, youtube.com, etc.)
  const directMatch = lower.match(/([a-z0-9-]+\.(com|org|io|so|app|tv|net|edu|dev|md))\b/i);
  if (directMatch) {
    const domain = directMatch[0].toLowerCase();
    const found = SITE_MAP.find(s => s.domain.toLowerCase() === domain || s.domain.includes(domain));
    return { detectedDomain: domain, detectedSiteName: found?.name ?? domain, confidence: 'high' };
  }

  // Step 2: Keyword matching (longest match wins)
  let bestMatch: { domain: string; name: string; klen: number } | null = null;
  for (const site of SITE_MAP) {
    for (const kw of site.keywords) {
      const esc = kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      if (new RegExp(`\\b${esc}\\b`, 'i').test(lower)) {
        if (!bestMatch || kw.length > bestMatch.klen) {
          bestMatch = { domain: site.domain, name: site.name, klen: kw.length };
        }
      }
    }
  }

  if (bestMatch) {
    return {
      detectedDomain: bestMatch.domain,
      detectedSiteName: bestMatch.name,
      confidence: bestMatch.klen >= 5 ? 'high' : 'medium',
    };
  }

  return { detectedDomain: null, detectedSiteName: null, confidence: 'none' };
}

/**
 * Does the goal text strongly suggest the user wants to focus ON a specific site?
 * Used to show the "Switch to Allowlist?" prompt.
 */
export function goalSuggestsAllowlist(goalText: string): boolean {
  const parsed = parseGoalForDomain(goalText);
  if (parsed.confidence === 'none') return false;
  const lower = goalText.toLowerCase();
  return ALLOWLIST_VERBS.some(v => lower.includes(v));
}
