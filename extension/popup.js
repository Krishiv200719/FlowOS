// ═══════════════════════════════════════════════════════════
// FlowOS — Popup Controller
// Features: session start/end, allowlist mode (Feature A),
// natural language goal parser (Addendum)
// ═══════════════════════════════════════════════════════════

(() => {
  // ─── DOM Elements ───────────────────────────────────────
  const idleView = document.getElementById('idleView');
  const activeView = document.getElementById('activeView');
  const statusDot = document.getElementById('statusDot');
  const greeting = document.getElementById('greeting');

  // Idle view elements
  const goalInput = document.getElementById('goalInput');
  const durationSlider = document.getElementById('durationSlider');
  const durationDisplay = document.getElementById('durationDisplay');
  const sliderFill = document.getElementById('sliderFill');
  const startBtn = document.getElementById('startBtn');
  const presetBtns = document.querySelectorAll('.preset-btn');

  // Active view elements
  const timerDisplay = document.getElementById('timerDisplay');
  const plannedDisplay = document.getElementById('plannedDisplay');
  const activeGoal = document.getElementById('activeGoal');
  const statFocus = document.getElementById('statFocus');
  const statSwitches = document.getElementById('statSwitches');
  const endBtn = document.getElementById('endBtn');

  let timerInterval = null;

  // ─── Feature A: Mode State ──────────────────────────────
  let currentMode = 'blocklist'; // 'blocklist' | 'allowlist'

  // ─── Natural Language Goal Parser (Addendum) ────────────

  const SITE_MAP_POPUP = [
    { keywords: ['youtube', 'yt', 'watch video', 'watching video', 'watching yt', 'watch yt'], domain: 'youtube.com', name: 'YouTube' },
    { keywords: ['netflix'], domain: 'netflix.com', name: 'Netflix' },
    { keywords: ['twitch', 'stream', 'streaming'], domain: 'twitch.tv', name: 'Twitch' },
    { keywords: ['notion', 'notion page'], domain: 'notion.so', name: 'Notion' },
    { keywords: ['github', 'pull request', 'pr review', 'code review'], domain: 'github.com', name: 'GitHub' },
    { keywords: ['stackoverflow', 'stack overflow'], domain: 'stackoverflow.com', name: 'Stack Overflow' },
    { keywords: ['leetcode', 'leet code', 'coding problem', 'dsa', 'algorithms'], domain: 'leetcode.com', name: 'LeetCode' },
    { keywords: ['figma', 'designing in figma'], domain: 'figma.com', name: 'Figma' },
    { keywords: ['google docs', 'gdocs', 'writing doc'], domain: 'docs.google.com', name: 'Google Docs' },
    { keywords: ['google sheets', 'sheets', 'spreadsheet'], domain: 'sheets.google.com', name: 'Google Sheets' },
    { keywords: ['coursera'], domain: 'coursera.org', name: 'Coursera' },
    { keywords: ['udemy'], domain: 'udemy.com', name: 'Udemy' },
    { keywords: ['wikipedia', 'wiki'], domain: 'wikipedia.org', name: 'Wikipedia' },
    { keywords: ['medium'], domain: 'medium.com', name: 'Medium' },
    { keywords: ['reddit'], domain: 'reddit.com', name: 'Reddit' },
    { keywords: ['twitter', 'tweets'], domain: 'twitter.com', name: 'Twitter/X' },
    { keywords: ['instagram'], domain: 'instagram.com', name: 'Instagram' },
    { keywords: ['gmail', 'email', 'inbox'], domain: 'gmail.com', name: 'Gmail' },
    { keywords: ['slack'], domain: 'slack.com', name: 'Slack' },
    { keywords: ['discord'], domain: 'discord.com', name: 'Discord' },
    { keywords: ['linear'], domain: 'linear.app', name: 'Linear' },
    { keywords: ['jira'], domain: 'jira.atlassian.com', name: 'Jira' },
    { keywords: ['trello'], domain: 'trello.com', name: 'Trello' },
    { keywords: ['asana'], domain: 'asana.com', name: 'Asana' },
    { keywords: ['canva'], domain: 'canva.com', name: 'Canva' },
    { keywords: ['framer'], domain: 'framer.com', name: 'Framer' },
    { keywords: ['replit'], domain: 'replit.com', name: 'Replit' },
    { keywords: ['airtable'], domain: 'airtable.com', name: 'Airtable' },
    { keywords: ['duolingo', 'language learning'], domain: 'duolingo.com', name: 'Duolingo' },
    { keywords: ['brilliant'], domain: 'brilliant.org', name: 'Brilliant' },
    { keywords: ['khan academy', 'khanacademy'], domain: 'khanacademy.org', name: 'Khan Academy' },
    { keywords: ['hackerrank', 'hacker rank'], domain: 'hackerrank.com', name: 'HackerRank' },
    { keywords: ['adobe', 'photoshop', 'illustrator'], domain: 'adobe.com', name: 'Adobe' },
    { keywords: ['substack'], domain: 'substack.com', name: 'Substack' },
    { keywords: ['arxiv', 'research paper'], domain: 'arxiv.org', name: 'arXiv' },
    { keywords: ['amazon'], domain: 'amazon.com', name: 'Amazon' },
    { keywords: ['shopify'], domain: 'shopify.com', name: 'Shopify' },
    { keywords: ['dribbble'], domain: 'dribbble.com', name: 'Dribbble' },
  ];

  const ALLOWLIST_VERBS = ['watch', 'watching', 'study on', 'studying on', 'using', 'focus on',
    'working on', 'working in', 'read on', 'reading on', 'browse', 'browsing',
    'practice on', 'learn on', 'learning on', 'course on', 'design in',
    'designing in', 'code on', 'coding on'];

  function parseGoalForDomain(goalText) {
    if (!goalText || goalText.trim().length < 3) return null;
    const lower = goalText.toLowerCase().trim();
    const directMatch = lower.match(/([a-z0-9-]+\.(com|org|io|so|app|tv|net|edu|dev|md))\b/i);
    if (directMatch) {
      const domain = directMatch[0].toLowerCase();
      const found = SITE_MAP_POPUP.find(s => s.domain.toLowerCase() === domain || s.domain.includes(domain));
      return { domain, name: found?.name ?? domain };
    }
    let best = null; let bestLen = 0;
    for (const site of SITE_MAP_POPUP) {
      for (const kw of site.keywords) {
        const esc = kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        if (new RegExp(`\\b${esc}\\b`, 'i').test(lower) && kw.length > bestLen) {
          bestLen = kw.length;
          best = { domain: site.domain, name: site.name };
        }
      }
    }
    return best;
  }

  function goalSuggestsAllowlist(goalText) {
    const parsed = parseGoalForDomain(goalText);
    if (!parsed) return false;
    const lower = goalText.toLowerCase();
    return ALLOWLIST_VERBS.some(v => lower.includes(v));
  }

  // ─── Initialize ─────────────────────────────────────────

  init();

  async function init() {
    setGreeting();
    setupSlider();
    setupPresets();
    setupFocusMode();      // Feature A
    setupGoalAutoDetect(); // Addendum
    setupStartButton();
    setupEndButton();

    try {
      const response = await sendMessage({ type: 'GET_STATUS' });
      if (response?.sessionActive && response?.currentSession) {
        showActiveView(response.currentSession);
      } else {
        showIdleView();
      }
    } catch (err) {
      console.error('[FlowOS Popup] Error checking status:', err);
      showIdleView();
    }
  }

  // ─── Feature A: Focus Mode Setup ────────────────────────

  function setupFocusMode() {
    const modeBlocklist = document.getElementById('modeBlocklist');
    const modeAllowlist = document.getElementById('modeAllowlist');
    const allowlistGroup = document.getElementById('allowlistGroup');

    modeBlocklist.addEventListener('click', () => {
      currentMode = 'blocklist';
      modeBlocklist.classList.add('active');
      modeAllowlist.classList.remove('active');
      allowlistGroup.style.display = 'none';
    });

    modeAllowlist.addEventListener('click', () => {
      currentMode = 'allowlist';
      modeAllowlist.classList.add('active');
      modeBlocklist.classList.remove('active');
      allowlistGroup.style.display = 'block';
      // Auto-fill from goal if parser has a match
      const parsed = parseGoalForDomain(goalInput.value);
      if (parsed) {
        const inp = document.getElementById('allowlistInput');
        if (inp && !inp.value) inp.value = parsed.domain;
      }
      document.getElementById('allowlistInput')?.focus();
    });
  }

  // ─── Addendum: Goal Auto-Detect ──────────────────────────

  function setupGoalAutoDetect() {
    const banner = document.getElementById('flowos-suggestion-banner');
    let shown = false;

    goalInput.addEventListener('input', () => {
      const text = goalInput.value;
      const parsed = parseGoalForDomain(text);
      const suggests = goalSuggestsAllowlist(text);

      // If already in allowlist mode, auto-fill domain
      if (currentMode === 'allowlist' && parsed) {
        const inp = document.getElementById('allowlistInput');
        if (inp && !inp.value) {
          inp.value = parsed.domain;
          inp.style.borderColor = '#00F5FF';
          setTimeout(() => { inp.style.borderColor = ''; }, 1500);
        }
        hideBanner(banner);
        shown = false;
        return;
      }

      // In blocklist mode: show suggestion banner
      if (currentMode === 'blocklist' && parsed && suggests && !shown) {
        showBanner(banner, parsed.name, parsed.domain);
        shown = true;
      } else if (!parsed || !suggests) {
        hideBanner(banner);
        shown = false;
      }
    });
  }

  function showBanner(banner, siteName, domain) {
    banner.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;">
        <span style="color:#888;">🎯 Looks like you're focusing on <strong style="color:#00F5FF;">${siteName}</strong></span>
        <button id="switchToAllowlist" style="background:rgba(0,245,255,0.1);border:1px solid rgba(0,245,255,0.3);border-radius:4px;color:#00F5FF;font-size:10px;font-family:'JetBrains Mono',monospace;padding:4px 8px;cursor:pointer;white-space:nowrap;">Use Allowlist →</button>
      </div>
    `;
    banner.style.display = 'block';
    document.getElementById('switchToAllowlist')?.addEventListener('click', () => {
      document.getElementById('modeAllowlist')?.click();
      const inp = document.getElementById('allowlistInput');
      if (inp) inp.value = domain;
      hideBanner(banner);
    });
  }

  function hideBanner(banner) {
    if (banner) banner.style.display = 'none';
  }

  // ─── Greeting ───────────────────────────────────────────

  function setGreeting() {
    const hour = new Date().getHours();
    let text;
    if (hour < 12) text = 'Good morning. Time to do real work.';
    else if (hour < 17) text = 'Good afternoon. Let\'s lock in.';
    else if (hour < 21) text = 'Good evening. One more push.';
    else text = 'Late night session. Make it count.';
    greeting.textContent = text;
  }

  // ─── Slider ─────────────────────────────────────────────

  function setupSlider() {
    durationSlider.addEventListener('input', () => {
      updateSliderUI(parseInt(durationSlider.value));
    });
  }

  function updateSliderUI(value) {
    const percent = ((value - 15) / (180 - 15)) * 100;
    sliderFill.style.width = `${percent}%`;

    if (value >= 60) {
      const hours = Math.floor(value / 60);
      const mins = value % 60;
      durationDisplay.innerHTML = mins > 0
        ? `${hours}h ${mins} <span>min</span>`
        : `${hours} <span>hr</span>`;
    } else {
      durationDisplay.innerHTML = `${value} <span>min</span>`;
    }

    // Update preset active states
    presetBtns.forEach(btn => {
      btn.classList.toggle('active', parseInt(btn.dataset.duration) === value);
    });
  }

  // ─── Presets ────────────────────────────────────────────

  function setupPresets() {
    presetBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const value = parseInt(btn.dataset.duration);
        durationSlider.value = value;
        updateSliderUI(value);
      });
    });
  }

  // ─── Start Session ──────────────────────────────────────

  function setupStartButton() {
    startBtn.addEventListener('click', async () => {
      const goal = goalInput.value.trim();
      const duration = parseInt(durationSlider.value);

      if (!goal) {
        goalInput.style.borderColor = '#FF3B3B';
        goalInput.style.borderStyle = 'solid';
        goalInput.setAttribute('placeholder', 'Please enter a goal first...');
        goalInput.focus();
        setTimeout(() => {
          goalInput.style.borderColor = '';
          goalInput.style.borderStyle = '';
          goalInput.setAttribute('placeholder', 'e.g. Write chapter 2...');
        }, 2000);
        return;
      }

      // Feature A: gather allowlist domain
      const allowlistRaw = document.getElementById('allowlistInput')?.value.trim() ?? '';
      const allowlistDomain = currentMode === 'allowlist' && allowlistRaw
        ? allowlistRaw.replace(/^https?:\/\//i, '').replace(/^www\./i, '').split('/')[0].toLowerCase()
        : null;

      startBtn.disabled = true;
      startBtn.textContent = 'STARTING...';

      try {
        const response = await sendMessage({
          type: 'START_SESSION',
          goal: goal,
          plannedDuration: duration,
          allowlistDomain: allowlistDomain,  // Feature A
          mode: currentMode,                  // Feature A
        });

        if (response?.success) {
          const status = await sendMessage({ type: 'GET_STATUS' });
          if (status?.currentSession) {
            showActiveView(status.currentSession);
          }
        } else {
          throw new Error(response?.error || 'Failed to start session');
        }
      } catch (err) {
        console.error('[FlowOS] Start failed:', err);
        startBtn.disabled = false;
        startBtn.textContent = 'START FOCUS SESSION →';
      }
    });
  }

  // ─── End Session ────────────────────────────────────────

  function setupEndButton() {
    endBtn.addEventListener('click', async () => {
      endBtn.disabled = true;
      endBtn.textContent = 'ENDING...';

      try {
        const response = await sendMessage({ type: 'END_SESSION' });
        if (response?.success) {
          stopTimer();
          showIdleView();
          // Reset form
          goalInput.value = '';
          durationSlider.value = 30;
          updateSliderUI(30);
        } else {
          throw new Error(response?.error || 'Failed to end session');
        }
      } catch (err) {
        console.error('[FlowOS] End failed:', err);
        endBtn.disabled = false;
        endBtn.textContent = 'END SESSION';
      }
    });
  }

  // ─── View Management ────────────────────────────────────

  function showIdleView() {
    idleView.style.display = 'block';
    activeView.style.display = 'none';
    statusDot.classList.remove('active');
    startBtn.disabled = false;
    startBtn.textContent = 'START FOCUS SESSION →';
    stopTimer();
  }

  function showActiveView(session) {
    idleView.style.display = 'none';
    activeView.style.display = 'block';
    statusDot.classList.add('active');

    activeGoal.textContent = session.goal || '—';

    // Feature A: show mode indicator badge
    const modeIndicator = document.getElementById('modeIndicator');
    if (modeIndicator) {
      if (session.allowlistDomain) {
        modeIndicator.textContent = `🎯 ALLOWLIST: ${session.allowlistDomain}`;
        modeIndicator.style.color = '#00F5FF';
        modeIndicator.style.borderColor = 'rgba(0,245,255,0.3)';
        modeIndicator.classList.add('visible');
      } else {
        modeIndicator.textContent = '🛡️ BLOCKLIST: distraction sites flagged';
        modeIndicator.style.color = '#888888';
        modeIndicator.style.borderColor = '#1C1C1C';
        modeIndicator.classList.add('visible');
      }
    }

    // Set planned time
    const plannedMin = session.plannedDuration || 30;
    plannedDisplay.textContent = formatTimer(plannedMin * 60 * 1000);

    // Compute live stats
    updateLiveStats(session);

    // Start timer
    startTimer(session.startTime);
  }

  // ─── Timer ──────────────────────────────────────────────

  function startTimer(startTime) {
    stopTimer();
    updateTimer(startTime);
    timerInterval = setInterval(() => updateTimer(startTime), 1000);
  }

  function stopTimer() {
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
  }

  function updateTimer(startTime) {
    const elapsed = Date.now() - startTime;
    timerDisplay.textContent = formatTimer(elapsed);
  }

  function formatTimer(ms) {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0) {
      return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
    }
    return `${pad(minutes)}:${pad(seconds)}`;
  }

  function pad(n) {
    return n.toString().padStart(2, '0');
  }

  // ─── Live Stats ─────────────────────────────────────────

  function updateLiveStats(session) {
    if (!session?.events) {
      statFocus.textContent = '0';
      statSwitches.textContent = '0';
      return;
    }

    let focusMs = 0;
    let distractionMs = 0;
    let idleMs = 0;
    let switches = 0;
    const now = Date.now();
    const lastIdx = session.events.length - 1;

    for (let i = 0; i < session.events.length; i++) {
      const event = session.events[i];
      // BUG 1 FIX: for the running (last) event, estimate elapsed
      // since it started — this eliminates the 30s jump
      const dur = (i === lastIdx)
        ? Math.max(event.duration || 0, now - event.timestamp)
        : (event.duration || 0);

      if (event.type === 'focus') focusMs += dur;
      else if (event.type === 'distraction') distractionMs += dur;
      else if (event.type === 'idle' || event.type === 'locked') idleMs += dur;
      else if (event.type === 'tab_switch') switches++;
    }

    const focusMin = Math.round(focusMs / 60000);
    statFocus.textContent = focusMin.toString();
    statSwitches.textContent = switches.toString();

    // Color the focus stat
    const ratio = session.plannedDuration > 0
      ? focusMs / (session.plannedDuration * 60000)
      : 0;
    statFocus.className = 'stat-mini-value ' + (ratio > 0.6 ? 'good' : ratio > 0.3 ? 'warn' : 'bad');

    // UPGRADE #7: Update focus quality meter
    const focusMeterFill = document.getElementById('focusMeterFill');
    const focusMeterPct = document.getElementById('focusMeterPct');
    if (focusMeterFill && focusMeterPct) {
      const pct = Math.round(Math.min(ratio, 1) * 100);
      focusMeterFill.style.width = `${pct}%`;
      focusMeterFill.style.backgroundColor =
        ratio > 0.6 ? '#00D46A' : ratio > 0.3 ? '#FF6B35' : '#FF3B3B';
      focusMeterPct.textContent = `${pct}%`;
    }
  }

  // ─── Refresh live stats periodically ────────────────────

  // BUG 1 FIX: poll every 2s (was 5s) so focus meter feels live
  setInterval(async () => {
    if (activeView.style.display !== 'none') {
      try {
        const status = await sendMessage({ type: 'GET_STATUS' });
        if (status?.currentSession) {
          updateLiveStats(status.currentSession);
        } else {
          // Session ended externally — switch back to idle view
          stopTimer();
          showIdleView();
        }
      } catch (_) {}
    }
  }, 2000);

  // ─── Chrome Message Helper ──────────────────────────────

  function sendMessage(message) {
    return new Promise((resolve, reject) => {
      try {
        chrome.runtime.sendMessage(message, (response) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve(response);
          }
        });
      } catch (err) {
        reject(err);
      }
    });
  }

  // ─── Test Notification Button ───────────────────────────

  const testNotifBtn = document.getElementById('testNotifBtn');
  const testNotifResult = document.getElementById('testNotifResult');

  if (testNotifBtn) {
    testNotifBtn.addEventListener('click', async () => {
      testNotifBtn.disabled = true;
      testNotifBtn.textContent = 'sending...';
      testNotifResult.style.color = '#555';
      testNotifResult.textContent = '';

      try {
        const res = await sendMessage({ type: 'TEST_NOTIFICATION' });
        if (res && res.success) {
          testNotifResult.style.color = '#00D46A';
          testNotifResult.textContent = 'ok — check your notifications';
        } else {
          testNotifResult.style.color = '#FF3B3B';
          testNotifResult.textContent = 'failed — reload extension';
        }
      } catch (err) {
        testNotifResult.style.color = '#FF3B3B';
        testNotifResult.textContent = 'error: ' + err.message;
      } finally {
        testNotifBtn.disabled = false;
        testNotifBtn.textContent = 'test notifications';
      }
    });
  }

})();
