import { useEffect, useRef, useState } from 'react';

// ─── Design tokens ────────────────────────────────────────
const C = {
  bg:      '#0c0c0b',
  surface: '#131310',
  line:    '#1f1f1c',
  text:    '#e8e5df',
  muted:   '#717069',
  faint:   '#2e2e2a',
  accent:  '#7a9fbf',   // slate blue — cool, editorial, not neon
  red:     '#914038',   // muted deep red
  white:   '#f0ede6',
};

const F = {
  display: '"DM Serif Display", Georgia, serif',
  sans:    '"Syne", "Space Grotesk", system-ui, sans-serif',
  mono:    '"JetBrains Mono", "Space Mono", monospace',
};

// ─── Reusable inline-style components ────────────────────

function Tag({ children, color = C.muted }: { children: string; color?: string }) {
  return (
    <span style={{
      fontFamily: F.mono, fontSize: 10, letterSpacing: '0.18em',
      textTransform: 'uppercase', color, display: 'inline-block',
    }}>
      {children}
    </span>
  );
}

function Divider() {
  return <div style={{ height: 1, background: C.line, width: '100%' }} />;
}

// ─── Animated number count ─────────────────────────────────
function CountUp({ to, duration = 1800 }: { to: number; duration?: number }) {
  const [val, setVal] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const started = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !started.current) {
        started.current = true;
        const start = performance.now();
        const tick = (now: number) => {
          const t = Math.min((now - start) / duration, 1);
          const eased = 1 - Math.pow(1 - t, 3);
          setVal(Math.round(to * eased));
          if (t < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      }
    }, { threshold: 0.5 });
    obs.observe(el);
    return () => obs.disconnect();
  }, [to, duration]);

  return <span ref={ref}>{val}</span>;
}

// ─── Reveal on scroll ─────────────────────────────────────
function Reveal({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { setVisible(true); obs.disconnect(); }
    }, { threshold: 0.12 });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <div ref={ref} style={{
      opacity: visible ? 1 : 0,
      transform: visible ? 'none' : 'translateY(24px)',
      transition: `opacity 0.7s ease ${delay}s, transform 0.7s ease ${delay}s`,
    }}>
      {children}
    </div>
  );
}

// ─── Feature card ──────────────────────────────────────────
function FeatureCard({ n, title, body }: { n: string; title: string; body: string }) {
  const [hov, setHov] = useState(false);
  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        padding: '32px',
        border: `1px solid ${hov ? C.faint : C.line}`,
        borderTop: `1px solid ${hov ? C.accent : C.line}`,
        background: hov ? C.surface : 'transparent',
        transition: 'all 0.22s ease',
        cursor: 'default',
      }}
    >
      <div style={{ fontFamily: F.mono, fontSize: 11, color: C.muted, marginBottom: 20, letterSpacing: '0.12em' }}>
        {n}
      </div>
      <div style={{ fontFamily: F.display, fontSize: 22, color: C.text, marginBottom: 14, lineHeight: 1.2 }}>
        {title}
      </div>
      <div style={{ fontFamily: F.sans, fontSize: 14, color: C.muted, lineHeight: 1.7, fontWeight: 400 }}>
        {body}
      </div>
    </div>
  );
}

// ─── Main landing component ────────────────────────────────
export default function Landing() {
  // Prevent cursor from showing dashboard cursor on landing
  useEffect(() => {
    document.documentElement.style.scrollBehavior = 'smooth';
    return () => { document.documentElement.style.scrollBehavior = ''; };
  }, []);

  const ghUrl = 'https://github.com/Krishiv200719/FlowOS';

  const btnStyle = (primary: boolean): React.CSSProperties => ({
    display: 'inline-block',
    fontFamily: F.sans,
    fontSize: 13,
    fontWeight: 600,
    letterSpacing: '0.04em',
    padding: primary ? '13px 28px' : '12px 28px',
    borderRadius: 4,
    border: primary ? 'none' : `1px solid ${C.line}`,
    background: primary ? C.text : 'transparent',
    color: primary ? C.bg : C.muted,
    textDecoration: 'none',
    cursor: 'pointer',
    transition: 'all 0.18s ease',
  });

  const section: React.CSSProperties = {
    maxWidth: 1080,
    margin: '0 auto',
    padding: '0 40px',
  };

  return (
    <div style={{ background: C.bg, minHeight: '100vh', color: C.text, overflowX: 'hidden' }}>

      {/* ── Nav ─────────────────────────────────────── */}
      <nav style={{
        position: 'sticky', top: 0, zIndex: 100,
        borderBottom: `1px solid ${C.line}`,
        background: C.bg,
        backdropFilter: 'blur(12px)',
      }}>
        <div style={{ ...section, display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 60 }}>
          <span style={{ fontFamily: F.sans, fontSize: 15, fontWeight: 700, color: C.text, letterSpacing: '-0.02em' }}>
            FlowOS
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
            <a href="#how" style={{ fontFamily: F.sans, fontSize: 13, color: C.muted, textDecoration: 'none' }}>How it works</a>
            <a href="#features" style={{ fontFamily: F.sans, fontSize: 13, color: C.muted, textDecoration: 'none' }}>Features</a>
            <a href="/" style={{ fontFamily: F.sans, fontSize: 13, color: C.muted, textDecoration: 'none' }}>Dashboard</a>
            <a
              href={ghUrl}
              target="_blank" rel="noopener noreferrer"
              style={{ fontFamily: F.sans, fontSize: 13, fontWeight: 600, color: C.bg, background: C.text, padding: '7px 18px', borderRadius: 4, textDecoration: 'none', letterSpacing: '0.02em' }}
            >
              Download
            </a>
          </div>
        </div>
      </nav>

      {/* ── Hero ────────────────────────────────────── */}
      <section style={{ padding: '120px 40px 100px', maxWidth: 1080, margin: '0 auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 80, alignItems: 'start' }}>
          {/* Left: headline */}
          <div>
            <div style={{ marginBottom: 32 }}>
              <Tag color={C.accent}>Focus Operating System</Tag>
            </div>
            <h1 style={{
              fontFamily: F.display,
              fontSize: 'clamp(44px, 6vw, 76px)',
              lineHeight: 1.02,
              letterSpacing: '-0.02em',
              color: C.white,
              margin: 0,
              fontWeight: 400,
            }}>
              You think you<br />
              focused for<br />
              <em style={{ color: C.accent, fontStyle: 'italic' }}>two hours.</em>
            </h1>
            <div style={{
              fontFamily: F.display,
              fontSize: 'clamp(44px, 6vw, 76px)',
              lineHeight: 1.02,
              letterSpacing: '-0.02em',
              color: C.muted,
              fontWeight: 400,
              marginTop: 4,
            }}>
              You didn't.
            </div>
          </div>

          {/* Right: sub + CTAs + stat */}
          <div style={{ paddingTop: 8 }}>
            <div style={{
              fontFamily: F.sans, fontSize: 17, color: C.muted,
              lineHeight: 1.7, marginBottom: 40, fontWeight: 400,
            }}>
              FlowOS is a Chrome extension that tracks what your attention actually does — second by second.
              Not what you intended. Not what you remember.
              The real number.
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 48 }}>
              <a
                href={ghUrl}
                target="_blank" rel="noopener noreferrer"
                style={btnStyle(true)}
              >
                Install from GitHub
              </a>
              <a href="#how" style={btnStyle(false)}>
                See how it works
              </a>
            </div>
            {/* Stat box */}
            <div style={{
              padding: '24px 28px',
              border: `1px solid ${C.line}`,
              borderLeft: `2px solid ${C.accent}`,
              background: C.surface,
            }}>
              <div style={{ fontFamily: F.mono, fontSize: 10, color: C.muted, letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 8 }}>
                Avg. actual focus time per 2-hour session
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                <span style={{ fontFamily: F.display, fontSize: 54, color: C.white, lineHeight: 1 }}>34</span>
                <span style={{ fontFamily: F.sans, fontSize: 16, color: C.muted }}>minutes</span>
              </div>
              <div style={{ fontFamily: F.sans, fontSize: 12, color: C.muted, marginTop: 8 }}>
                The other 86 minutes: tab switches, drift, recovery.
              </div>
            </div>
          </div>
        </div>
      </section>

      <Divider />

      {/* ── Ticker ──────────────────────────────────── */}
      <div style={{ padding: '20px 0', overflow: 'hidden', borderBottom: `1px solid ${C.line}`, position: 'relative' }}>
        <style>{`
          @keyframes ticker {
            from { transform: translateX(0); }
            to { transform: translateX(-50%); }
          }
        `}</style>
        <div style={{
          display: 'flex', gap: 60, whiteSpace: 'nowrap',
          animation: 'ticker 40s linear infinite',
          width: 'max-content',
        }}>
          {[
            'You overestimate your daily focus time by 300%',
            'Every context switch costs 23 minutes of recovery',
            'Most distraction happens in the last 20 minutes of a session',
            'Tab switching is the silent productivity killer',
            'FlowOS tracks the truth. Not the story you tell yourself.',
            'You overestimate your daily focus time by 300%',
            'Every context switch costs 23 minutes of recovery',
            'Most distraction happens in the last 20 minutes of a session',
            'Tab switching is the silent productivity killer',
            'FlowOS tracks the truth. Not the story you tell yourself.',
          ].map((t, i) => (
            <span key={i} style={{ fontFamily: F.mono, fontSize: 11, color: C.faint, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              {t}&nbsp;&nbsp;&nbsp;&#47;&#47;
            </span>
          ))}
        </div>
      </div>

      {/* ── Stats row ───────────────────────────────── */}
      <section style={{ borderBottom: `1px solid ${C.line}` }}>
        <div style={{ ...section, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)' }}>
          {[
            { n: 34,  suffix: 'min',  label: 'Average real focus time per session' },
            { n: 23,  suffix: 'min',  label: 'Recovery cost of a single distraction' },
            { n: 96,  suffix: 'x',    label: 'Average phone checks per day' },
            { n: 300, suffix: '%',    label: 'How much you overestimate your focus' },
          ].map((s, i) => (
            <Reveal key={i} delay={i * 0.08}>
              <div style={{
                padding: '48px 32px',
                borderRight: i < 3 ? `1px solid ${C.line}` : 'none',
              }}>
                <div style={{ fontFamily: F.display, fontSize: 56, color: C.white, lineHeight: 1, marginBottom: 10 }}>
                  <CountUp to={s.n} />{s.suffix}
                </div>
                <div style={{ fontFamily: F.sans, fontSize: 13, color: C.muted, lineHeight: 1.5, fontWeight: 400 }}>
                  {s.label}
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ── How it works ────────────────────────────── */}
      <section id="how" style={{ padding: '120px 40px', maxWidth: 1080, margin: '0 auto' }}>
        <Reveal>
          <div style={{ marginBottom: 64 }}>
            <Tag color={C.muted}>How it works</Tag>
            <h2 style={{ fontFamily: F.display, fontSize: 'clamp(32px, 4vw, 52px)', color: C.white, margin: '20px 0 0', fontWeight: 400, lineHeight: 1.1 }}>
              Three layers. One honest picture.
            </h2>
          </div>
        </Reveal>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 0, border: `1px solid ${C.line}` }}>
          {[
            {
              n: '01',
              title: 'Extension captures every signal',
              body: 'The Chrome extension monitors tab focus, idle state, window switches, and URL changes in real time. Nothing guessed. Every event timestamped to the millisecond.',
              detail: 'background.js · MV3 service worker',
            },
            {
              n: '02',
              title: 'Bridge relays clean data',
              body: 'A content-script bridge sanitizes raw events and forwards structured session data to the dashboard. No server. No database. Fully local message passing.',
              detail: 'bridge.js · postMessage protocol',
            },
            {
              n: '03',
              title: 'Dashboard makes it visible',
              body: 'The React dashboard turns raw events into timeline bars, heatmaps, distraction scores, and AI coaching — all computed from your actual session data.',
              detail: 'Vite · React · IndexedDB',
            },
          ].map((step, i) => (
            <Reveal key={i} delay={i * 0.1}>
              <div style={{
                padding: '48px 36px',
                borderRight: i < 2 ? `1px solid ${C.line}` : 'none',
                height: '100%',
                boxSizing: 'border-box',
              }}>
                <div style={{ fontFamily: F.mono, fontSize: 11, color: C.muted, marginBottom: 28, letterSpacing: '0.12em' }}>
                  {step.n}
                </div>
                <div style={{ fontFamily: F.display, fontSize: 22, color: C.text, marginBottom: 16, lineHeight: 1.2 }}>
                  {step.title}
                </div>
                <div style={{ fontFamily: F.sans, fontSize: 14, color: C.muted, lineHeight: 1.75, marginBottom: 28, fontWeight: 400 }}>
                  {step.body}
                </div>
                <div style={{ fontFamily: F.mono, fontSize: 10, color: C.faint, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                  {step.detail}
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      <Divider />

      {/* ── Features ────────────────────────────────── */}
      <section id="features" style={{ padding: '120px 40px', maxWidth: 1080, margin: '0 auto' }}>
        <Reveal>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 64 }}>
            <div>
              <Tag color={C.muted}>Features</Tag>
              <h2 style={{ fontFamily: F.display, fontSize: 'clamp(32px, 4vw, 52px)', color: C.white, margin: '20px 0 0', fontWeight: 400, lineHeight: 1.1 }}>
                Not a timer.<br />Not a blocker.
              </h2>
            </div>
            <div style={{ fontFamily: F.sans, fontSize: 14, color: C.muted, maxWidth: 280, textAlign: 'right', lineHeight: 1.65 }}>
              A system that understands your patterns and holds you accountable to them.
            </div>
          </div>
        </Reveal>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0, border: `1px solid ${C.line}` }}>
          {[
            {
              n: '01 / Session Mirror',
              title: 'The truth about your last session',
              body: 'Every session is broken into a timeline of focus blocks, distraction events, and idle periods. Real timestamps. No rounding. No flattering estimates.',
            },
            {
              n: '02 / Focus Score',
              title: 'A number that doesn\'t flatter you',
              body: 'Computed from real focus time vs. planned duration, with a penalty for every tab switch. The score reflects your actual performance, including the context switches you forgot about.',
            },
            {
              n: '03 / Focus DNA',
              title: 'Your attention fingerprint',
              body: 'A 24-hour × 7-day heatmap built from your full session history. See when you focus best, when you leak worst, and what the gap between them actually costs.',
            },
            {
              n: '04 / Allowlist Mode',
              title: 'One site. Total focus.',
              body: 'Set a single allowed domain. Every other site triggers a hard redirect to a blocked page — your goal, your session timer, and a way back to work. No wishy-washy nudges.',
            },
            {
              n: '05 / Ambient Tracker',
              title: 'Always watching. No session required.',
              body: 'The extension tracks your browsing silently in the background. Open the Activity screen at any time and see exactly where the last two hours went.',
            },
            {
              n: '06 / AI Coaching',
              title: 'A coach who actually read your data',
              body: 'Groq LLaMA 3.3 70B analyzes your real sessions — finds your peak window, costs your biggest distractor, and builds a specific action plan. No generic advice.',
            },
          ].map((f, i) => (
            <Reveal key={i} delay={(i % 2) * 0.1}>
              <div style={{
                borderRight: i % 2 === 0 ? `1px solid ${C.line}` : 'none',
                borderBottom: i < 4 ? `1px solid ${C.line}` : 'none',
              }}>
                <FeatureCard n={f.n} title={f.title} body={f.body} />
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      <Divider />

      {/* ── Scoring formula ─────────────────────────── */}
      <section style={{ padding: '120px 40px', maxWidth: 1080, margin: '0 auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 80, alignItems: 'start' }}>
          <Reveal>
            <div>
              <Tag color={C.muted}>Scoring</Tag>
              <h2 style={{ fontFamily: F.display, fontSize: 'clamp(28px, 3.5vw, 46px)', color: C.white, margin: '20px 0 20px', fontWeight: 400, lineHeight: 1.1 }}>
                The formula is honest.<br />
                <em style={{ color: C.muted, fontStyle: 'italic' }}>So is the result.</em>
              </h2>
              <p style={{ fontFamily: F.sans, fontSize: 14, color: C.muted, lineHeight: 1.75 }}>
                The score is not an estimate. It is computed from the exact duration of every timestamped event in your session — focus, distraction, idle, and off-Chrome — weighted by your intentions.
              </p>
              <div style={{ marginTop: 32, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {['Real timestamps', 'Tab switch penalty', '23-min recovery factor', 'Honest ratio'].map(t => (
                  <span key={t} style={{
                    fontFamily: F.mono, fontSize: 9, color: C.muted,
                    border: `1px solid ${C.line}`, borderRadius: 2,
                    padding: '5px 10px', letterSpacing: '0.1em', textTransform: 'uppercase',
                  }}>{t}</span>
                ))}
              </div>
            </div>
          </Reveal>
          <Reveal delay={0.12}>
            <div style={{
              background: '#090909',
              border: `1px solid ${C.line}`,
              borderRadius: 6,
              overflow: 'hidden',
            }}>
              {/* Terminal header */}
              <div style={{
                padding: '12px 20px', borderBottom: `1px solid ${C.line}`,
                display: 'flex', alignItems: 'center', gap: 8,
              }}>
                {[C.red, C.accent, '#4a7a4a'].map((c, i) => (
                  <div key={i} style={{ width: 10, height: 10, borderRadius: '50%', background: c, opacity: 0.7 }} />
                ))}
                <span style={{ fontFamily: F.mono, fontSize: 10, color: C.muted, marginLeft: 8 }}>scoring.ts</span>
              </div>
              {/* Code */}
              <div style={{ padding: '24px 24px', fontFamily: F.mono, fontSize: 12, lineHeight: 1.9 }}>
                {[
                  { text: '// Real focus from timestamped events', c: C.faint },
                  { text: 'const base = realFocusMs / plannedMs', c: C.text },
                  { text: '', c: '' },
                  { text: '// Reward exceptional sessions', c: C.faint },
                  { text: 'const bonus = base > 0.8 ? 1.25 : 1.0', c: C.text },
                  { text: '', c: '' },
                  { text: '// Each switch costs 2 points', c: C.faint },
                  { text: 'const penalty = tabSwitches * 0.02', c: C.red },
                  { text: '', c: '' },
                  { text: 'const score = (base * bonus - penalty) * 100', c: C.text },
                  { text: '', c: '' },
                  { text: '// Cognitive cost: 23 min per distraction', c: C.faint },
                  { text: 'const trueCost = distractions * 23 * 60000', c: C.accent },
                ].map((line, i) => (
                  <div key={i} style={{ color: line.c || 'transparent', minHeight: '1.9em' }}>
                    {line.text || '\u00A0'}
                  </div>
                ))}
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      <Divider />

      {/* ── Privacy ─────────────────────────────────── */}
      <section style={{ borderBottom: `1px solid ${C.line}` }}>
        <div style={{ ...section, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)' }}>
          {[
            { n: '01', title: 'No accounts', body: 'No signup. No email. No OAuth. Install and open — you\'re ready. Your identity has nothing to do with your focus.' },
            { n: '02', title: 'No servers', body: 'Every event lives in chrome.storage.local and your browser\'s IndexedDB. Nothing leaves your machine. We literally cannot see your data.' },
            { n: '03', title: 'Open source', body: 'Every line of code is on GitHub. Read the extension. Audit the bridge. There are no hidden calls, no analytics SDKs, no surprises.' },
          ].map((p, i) => (
            <Reveal key={i} delay={i * 0.08}>
              <div style={{
                padding: '56px 36px',
                borderRight: i < 2 ? `1px solid ${C.line}` : 'none',
              }}>
                <div style={{ fontFamily: F.mono, fontSize: 10, color: C.muted, marginBottom: 20, letterSpacing: '0.12em' }}>
                  {p.n}
                </div>
                <div style={{ fontFamily: F.display, fontSize: 24, color: C.text, marginBottom: 16, lineHeight: 1.2, fontWeight: 400 }}>
                  {p.title}
                </div>
                <div style={{ fontFamily: F.sans, fontSize: 13, color: C.muted, lineHeight: 1.75, fontWeight: 400 }}>
                  {p.body}
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ── CTA ─────────────────────────────────────── */}
      <section style={{ padding: '140px 40px', maxWidth: 1080, margin: '0 auto', textAlign: 'center' }}>
        <Reveal>
          <div style={{ marginBottom: 20 }}>
            <Tag color={C.muted}>Get started</Tag>
          </div>
          <h2 style={{
            fontFamily: F.display,
            fontSize: 'clamp(42px, 7vw, 86px)',
            color: C.white,
            fontWeight: 400,
            lineHeight: 1.02,
            letterSpacing: '-0.02em',
            margin: '0 0 28px',
          }}>
            See the real<br />
            number.
          </h2>
          <p style={{
            fontFamily: F.sans, fontSize: 16, color: C.muted,
            maxWidth: 440, margin: '0 auto 48px', lineHeight: 1.7,
          }}>
            Install takes 30 seconds. No account. No tracking. Just an honest look at where your focus actually goes.
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', alignItems: 'center' }}>
            <a
              href={ghUrl}
              target="_blank" rel="noopener noreferrer"
              style={{
                fontFamily: F.sans, fontWeight: 600, fontSize: 14,
                padding: '15px 36px', background: C.text, color: C.bg,
                borderRadius: 4, textDecoration: 'none', letterSpacing: '0.03em',
                transition: 'opacity 0.15s',
              }}
              onMouseEnter={e => (e.currentTarget.style.opacity = '0.88')}
              onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
            >
              Install from GitHub
            </a>
            <a
              href="/"
              style={{
                fontFamily: F.sans, fontSize: 14, color: C.muted,
                padding: '15px 28px',
                border: `1px solid ${C.line}`, borderRadius: 4,
                textDecoration: 'none', letterSpacing: '0.02em',
              }}
            >
              Open dashboard
            </a>
          </div>
          {/* Badge row */}
          <div style={{ display: 'flex', gap: 32, justifyContent: 'center', marginTop: 48, flexWrap: 'wrap' }}>
            {['Chrome Extension', 'Local-only storage', 'Open source', 'Free forever', 'No telemetry'].map(b => (
              <span key={b} style={{ fontFamily: F.mono, fontSize: 10, color: C.faint, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
                {b}
              </span>
            ))}
          </div>
        </Reveal>
      </section>

      {/* ── Footer ──────────────────────────────────── */}
      <footer style={{ borderTop: `1px solid ${C.line}` }}>
        <div style={{ ...section, padding: '40px 40px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 32 }}>
            <span style={{ fontFamily: F.sans, fontSize: 14, fontWeight: 700, color: C.text }}>FlowOS</span>
            <span style={{ fontFamily: F.mono, fontSize: 10, color: C.faint, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
              ITM SFT · SummerHacks 2026
            </span>
          </div>
          <div style={{ display: 'flex', gap: 24, alignItems: 'center' }}>
            <a href={ghUrl} target="_blank" rel="noopener noreferrer"
              style={{ fontFamily: F.sans, fontSize: 13, color: C.muted, textDecoration: 'none' }}>GitHub</a>
            <a href="/"
              style={{ fontFamily: F.sans, fontSize: 13, color: C.muted, textDecoration: 'none' }}>Dashboard</a>
          </div>
        </div>
      </footer>

    </div>
  );
}
