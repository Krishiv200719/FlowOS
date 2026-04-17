// ═══════════════════════════════════════════════════════════
// FlowOS — Popup Controller
// Manages start/end session UI + live timer
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

  // ─── Initialize ─────────────────────────────────────────

  init();

  async function init() {
    setGreeting();
    setupSlider();
    setupPresets();
    setupStartButton();
    setupEndButton();

    // Check if there's an active session
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

      startBtn.disabled = true;
      startBtn.textContent = 'STARTING...';

      try {
        const response = await sendMessage({
          type: 'START_SESSION',
          goal: goal,
          plannedDuration: duration
        });

        if (response?.success) {
          // Re-fetch to get the full session object
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

    // Set goal
    activeGoal.textContent = session.goal || '—';

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
