// ═══════════════════════════════════════════════════════════
// FlowOS — Content Script: Focus Guardian
// Injects nudge overlays + handles Allowlist Mode banners
// ═══════════════════════════════════════════════════════════

(() => {
  // ─── State ─────────────────────────────────────────────
  let guardianBanner = null;
  let reentryModal = null;
  let distractionStartTime = null;
  let snoozeUntil = 0;
  let isShowingOverlay = false;

  // Allowlist mode state
  let currentIsAllowlistMode = false;
  let currentAllowlistDomain = null;

  // Thresholds
  const GUARDIAN_THRESHOLD_MS = 0;          // Immediate for blocklist
  const ALLOWLIST_THRESHOLD_MS = 1 * 1000;  // 1s for allowlist mode
  const SNOOZE_DURATION_MS = 120 * 1000;
  const REENTRY_THRESHOLD = 3;

  // ─── Stale DOM state guard ─────────────────────────────
  // Called before any check to ensure JS state matches DOM reality.
  // Fixes: banner removed by page JS but isShowingOverlay stuck true.
  function syncDOMState() {
    if (guardianBanner && !document.contains(guardianBanner)) {
      guardianBanner = null;
      isShowingOverlay = false;
    }
    if (reentryModal && !document.contains(reentryModal)) {
      reentryModal = null;
      isShowingOverlay = false;
    }
  }

  // ─── Message Handler ────────────────────────────────────

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    switch (message.type) {
      case 'DISTRACTION_DETECTED':
        handleDistraction(message);
        break;
      case 'SESSION_ENDED':
        cleanupAll();
        break;
    }
  });

  // ─── Distraction Logic ──────────────────────────────────

  function handleDistraction({ domain, sessionGoal, distractionCount, isAllowlistMode, allowlistDomain }) {
    syncDOMState(); // Fix stale state first

    currentIsAllowlistMode = isAllowlistMode || false;
    currentAllowlistDomain = allowlistDomain || null;

    if (Date.now() < snoozeUntil) return;

    if (!distractionStartTime) {
      distractionStartTime = Date.now();
    }

    const elapsed = Date.now() - distractionStartTime;
    const threshold = currentIsAllowlistMode ? ALLOWLIST_THRESHOLD_MS : GUARDIAN_THRESHOLD_MS;

    if (elapsed < threshold) return;

    if (distractionCount >= REENTRY_THRESHOLD && !reentryModal && !currentIsAllowlistMode) {
      removeGuardianBanner();
      showReentryModal(sessionGoal);
    } else if (!guardianBanner && !reentryModal) {
      showGuardianBanner(domain, elapsed, sessionGoal, currentIsAllowlistMode, currentAllowlistDomain);
    } else if (guardianBanner) {
      updateBannerTime(domain, elapsed);
    }
  }

  // ─── Guardian Banner ────────────────────────────────────

  function showGuardianBanner(domain, elapsedMs, sessionGoal, isAllowlistMode, allowlistDomain) {
    if (isShowingOverlay) return;
    isShowingOverlay = true;

    const timeText = formatDuration(elapsedMs);

    const bannerMessage = isAllowlistMode
      ? `You left <strong class="flowos-domain">${escapeHtml(allowlistDomain)}</strong> ${timeText} ago. Your session is waiting there.`
      : `You've been on <strong class="flowos-domain">${escapeHtml(domain)}</strong> for ${timeText}. Your session is waiting.`;

    const backButtonText = isAllowlistMode
      ? `Back to ${escapeHtml(allowlistDomain)}`
      : "I'm back";

    guardianBanner = document.createElement('div');
    guardianBanner.id = 'flowos-guardian-banner';
    guardianBanner.setAttribute('role', 'alert');
    guardianBanner.innerHTML = `
      <div class="flowos-banner-inner">
        <div class="flowos-banner-left">
          <span class="flowos-banner-pulse"></span>
          <span class="flowos-banner-text">
            <strong>FlowOS</strong> — ${bannerMessage}
          </span>
        </div>
        <div class="flowos-banner-actions">
          <button id="flowos-btn-back" class="flowos-btn flowos-btn-primary">
            ${backButtonText}
          </button>
          <button id="flowos-btn-snooze" class="flowos-btn flowos-btn-secondary">
            2 more min
          </button>
        </div>
      </div>
    `;

    document.documentElement.appendChild(guardianBanner);

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        guardianBanner?.classList.add('flowos-visible');
      });
    });

    document.getElementById('flowos-btn-back')?.addEventListener('click', onBackToWork);
    document.getElementById('flowos-btn-snooze')?.addEventListener('click', onSnooze);
  }

  function updateBannerTime(domain, elapsedMs) {
    const el = document.getElementById('flowos-elapsed-time');
    if (el) el.textContent = formatDuration(elapsedMs);
  }

  function removeGuardianBanner() {
    if (!guardianBanner) return;
    guardianBanner.classList.remove('flowos-visible');
    guardianBanner.classList.add('flowos-exiting');
    setTimeout(() => {
      guardianBanner?.remove();
      guardianBanner = null;
      isShowingOverlay = false;
    }, 300);
  }

  // ─── Re-entry Modal ─────────────────────────────────────

  function showReentryModal(goal) {
    if (isShowingOverlay) return;
    isShowingOverlay = true;

    reentryModal = document.createElement('div');
    reentryModal.id = 'flowos-reentry-modal';
    reentryModal.setAttribute('role', 'dialog');
    reentryModal.setAttribute('aria-modal', 'true');
    reentryModal.innerHTML = `
      <div class="flowos-modal-backdrop">
        <div class="flowos-modal-card">
          <div class="flowos-modal-glow"></div>
          <div class="flowos-modal-header">
            <span class="flowos-modal-icon">🧘</span>
          </div>
          <h2 class="flowos-modal-title">Take a breath.</h2>
          <p class="flowos-modal-subtitle">
            You've drifted a few times this session.<br>
            What is the <strong>ONE thing</strong> you're working on right now?
          </p>
          <input
            type="text"
            id="flowos-reentry-input"
            class="flowos-modal-input"
            placeholder="Type your task to re-anchor your focus..."
            value="${escapeHtml(goal || '')}"
            autocomplete="off"
            spellcheck="false"
          />
          <button id="flowos-reentry-submit" class="flowos-btn flowos-btn-primary flowos-btn-large">
            Back to work →
          </button>
          <p class="flowos-modal-footer">
            Writing your goal is a cognitive re-anchoring technique.
          </p>
        </div>
      </div>
    `;

    document.documentElement.appendChild(reentryModal);

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        reentryModal?.classList.add('flowos-visible');
        document.getElementById('flowos-reentry-input')?.focus();
      });
    });

    document.getElementById('flowos-reentry-submit')?.addEventListener('click', onReentrySubmit);
    document.getElementById('flowos-reentry-input')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && e.target.value.trim()) onReentrySubmit();
    });
  }

  function removeReentryModal() {
    if (!reentryModal) return;
    reentryModal.classList.remove('flowos-visible');
    reentryModal.classList.add('flowos-exiting');
    setTimeout(() => {
      reentryModal?.remove();
      reentryModal = null;
      isShowingOverlay = false;
    }, 300);
  }

  // ─── Actions ────────────────────────────────────────────

  function onBackToWork() {
    removeGuardianBanner();
    distractionStartTime = null;

    if (currentIsAllowlistMode && currentAllowlistDomain) {
      chrome.runtime.sendMessage({
        type: 'FOCUS_BACK_TO_ALLOWLIST',
        allowlistDomain: currentAllowlistDomain
      });
    } else {
      chrome.runtime.sendMessage({ type: 'FOCUS_BACK_TO_WORK' });
    }
  }

  function onSnooze() {
    removeGuardianBanner();
    snoozeUntil = Date.now() + SNOOZE_DURATION_MS;
    distractionStartTime = null;
  }

  function onReentrySubmit() {
    removeReentryModal();
    distractionStartTime = null;
    chrome.runtime.sendMessage({ type: 'FOCUS_BACK_TO_WORK' });
  }

  // ─── Cleanup ────────────────────────────────────────────

  function cleanupAll() {
    removeGuardianBanner();
    removeReentryModal();
    distractionStartTime = null;
    snoozeUntil = 0;
    isShowingOverlay = false;
  }

  // Fix: beforeunload does full cleanup (not just distractionStartTime)
  // so isShowingOverlay is never stale on the next page.
  window.addEventListener('beforeunload', cleanupAll);

  // ─── Self-initialisation on page load ───────────────────
  // Ask background: "Is this page currently a distraction?"
  // This catches the case where the tab was already open before
  // background.js could send DISTRACTION_DETECTED (timing race).
  chrome.runtime.sendMessage({ type: 'REQUEST_DISTRACTION_STATE' }, (response) => {
    if (chrome.runtime.lastError || !response?.isDistraction) return;
    handleDistraction(response);
  });

  // ─── Utilities ──────────────────────────────────────────

  function formatDuration(ms) {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    if (minutes >= 1) return `${minutes} min ${seconds > 0 ? seconds + 's' : ''}`.trim();
    return `${seconds}s`;
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  }
})();
