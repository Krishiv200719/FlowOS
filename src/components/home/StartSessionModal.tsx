// ═══════════════════════════════════════════════════════════
// FlowOS — Start Session Modal
// Features: Goal entry, Duration, Allowlist Mode (Feature A),
// Natural language goal parser (Addendum)
// ═══════════════════════════════════════════════════════════

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSessionContext } from '../../context/SessionContext';
import { parseGoalForDomain, goalSuggestsAllowlist } from '../../lib/goalParser';

interface StartSessionModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function StartSessionModal({ isOpen, onClose }: StartSessionModalProps) {
  const { extensionConnected } = useSessionContext();
  const [goal, setGoal] = useState('');
  const [duration, setDuration] = useState(60);
  const [mode, setMode] = useState<'blocklist' | 'allowlist'>('blocklist');
  const [allowlistDomain, setAllowlistDomain] = useState('');
  const [detectedSite, setDetectedSite] = useState<{ domain: string; name: string } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-focus goal input on open
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // Escape to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, onClose]);

  // Natural language goal detector
  useEffect(() => {
    if (goal.trim().length < 3) { setDetectedSite(null); return; }
    const parsed = parseGoalForDomain(goal);
    const suggests = goalSuggestsAllowlist(goal);
    if (parsed.detectedDomain && suggests) {
      setDetectedSite({ domain: parsed.detectedDomain, name: parsed.detectedSiteName ?? parsed.detectedDomain });
    } else {
      setDetectedSite(null);
    }
  }, [goal]);

  // Auto-fill allowlist domain when switching to allowlist mode
  useEffect(() => {
    if (mode === 'allowlist' && !allowlistDomain && goal.trim().length >= 3) {
      const parsed = parseGoalForDomain(goal);
      if (parsed.detectedDomain) setAllowlistDomain(parsed.detectedDomain);
    }
  }, [mode]);

  const handleStart = () => {
    if (!goal.trim()) return;

    const cleanAllowlist = mode === 'allowlist' && allowlistDomain.trim()
      ? allowlistDomain.trim().replace(/^https?:\/\//i, '').replace(/^www\./i, '').split('/')[0].toLowerCase()
      : null;

    if (extensionConnected) {
      window.postMessage(
        {
          source: 'flowos-dashboard',
          action: 'START_SESSION',
          goal: goal.trim(),
          plannedDuration: duration,
          allowlistDomain: cleanAllowlist,
          mode,
        },
        '*'
      );
    }

    localStorage.setItem(
      'flowos_active_session',
      JSON.stringify({
        goal: goal.trim(),
        plannedDuration: duration,
        startedAt: Date.now(),
        allowlistDomain: cleanAllowlist,
        mode,
      })
    );

    setGoal('');
    setDuration(60);
    setMode('blocklist');
    setAllowlistDomain('');
    setDetectedSite(null);
    onClose();

    window.dispatchEvent(new Event('flowos-session-started'));
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
          <motion.div
            className="card-dashed px-8 py-8 w-full max-w-md space-y-6"
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.2 }}
          >
            <h3 className="text-sm font-mono uppercase tracking-widest text-flow-cyan">
              Initiate Focus Session
            </h3>

            {/* Goal Input */}
            <div className="space-y-2">
              <label className="text-[10px] font-mono uppercase tracking-widest text-flow-muted">
                What will you work on?
              </label>
              <input
                ref={inputRef}
                type="text"
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleStart(); }}
                placeholder="e.g., watching youtube tutorial, build dashboard"
                className="w-full bg-flow-elevated border border-[#2A2A2A] rounded-lg px-4 py-3 text-sm text-white placeholder-flow-very-muted font-mono focus:outline-none focus:border-flow-cyan/50 transition-colors"
              />

              {/* Smart detection banner */}
              <AnimatePresence>
                {detectedSite && mode === 'blocklist' && (
                  <motion.div
                    className="flex items-center justify-between gap-3 px-4 py-3 rounded-lg"
                    style={{ background: 'rgba(0,245,255,0.05)', border: '1px solid rgba(0,245,255,0.2)' }}
                    initial={{ opacity: 0, y: -6, height: 0 }}
                    animate={{ opacity: 1, y: 0, height: 'auto' }}
                    exit={{ opacity: 0, y: -6, height: 0 }}
                  >
                    <span className="text-xs text-flow-muted">
                      🎯 Looks like you're focusing on{' '}
                      <strong className="text-flow-cyan">{detectedSite.name}</strong>
                    </span>
                    <button
                      type="button"
                      onClick={() => { setMode('allowlist'); setAllowlistDomain(detectedSite.domain); }}
                      className="text-[10px] font-mono text-flow-cyan border border-flow-cyan/30 rounded px-3 py-1 hover:bg-flow-cyan/10 transition-colors whitespace-nowrap flex-shrink-0"
                    >
                      Use Allowlist →
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Duration Slider */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-mono uppercase tracking-widest text-flow-muted">Planned Duration</label>
                <span className="text-sm font-mono text-flow-cyan">{duration} MIN</span>
              </div>
              <input
                type="range" min={15} max={180} step={15} value={duration}
                onChange={(e) => setDuration(parseInt(e.target.value))}
                className="w-full h-1 bg-flow-elevated rounded-full appearance-none cursor-pointer accent-[#00F5FF]"
              />
              <div className="flex justify-between text-[9px] font-mono text-flow-very-muted">
                <span>15</span><span>60</span><span>120</span><span>180</span>
              </div>
            </div>

            {/* Focus Mode Toggle (Feature A) */}
            <div className="space-y-2">
              <label className="text-[10px] font-mono uppercase tracking-widest text-flow-muted">Focus Mode</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => { setMode('blocklist'); setAllowlistDomain(''); }}
                  className={`px-3 py-2.5 rounded-lg text-xs font-mono border transition-all ${
                    mode === 'blocklist'
                      ? 'border-flow-cyan bg-flow-cyan/10 text-flow-cyan'
                      : 'border-[#2A2A2A] bg-[#111111] text-flow-muted hover:border-flow-muted/50'
                  }`}
                >
                  🛡️ Block distractions
                </button>
                <button
                  type="button"
                  onClick={() => setMode('allowlist')}
                  className={`px-3 py-2.5 rounded-lg text-xs font-mono border transition-all ${
                    mode === 'allowlist'
                      ? 'border-flow-cyan bg-flow-cyan/10 text-flow-cyan'
                      : 'border-[#2A2A2A] bg-[#111111] text-flow-muted hover:border-flow-muted/50'
                  }`}
                >
                  🎯 Focus on one site
                </button>
              </div>

              <AnimatePresence>
                {mode === 'allowlist' && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <input
                      type="text"
                      value={allowlistDomain}
                      onChange={(e) => setAllowlistDomain(e.target.value)}
                      placeholder="e.g. youtube.com, notion.so"
                      className="w-full bg-flow-elevated border border-[#2A2A2A] rounded-lg px-4 py-3 text-sm text-white placeholder-flow-very-muted font-mono focus:outline-none focus:border-flow-cyan/50 transition-colors mt-2"
                    />
                    {detectedSite && allowlistDomain === detectedSite.domain && (
                      <p className="text-[10px] font-mono text-flow-cyan mt-1">
                        ✓ Auto-detected: {detectedSite.name}
                      </p>
                    )}
                    <p className="text-[10px] font-mono text-[#444] mt-1.5">
                      ⚡ You'll be nudged if you leave this site for more than 45 seconds
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={handleStart}
                disabled={!goal.trim() || (mode === 'allowlist' && !allowlistDomain.trim())}
                className="flex-1 bg-flow-cyan text-flow-bg font-bold px-6 py-3 rounded-lg text-sm hover:shadow-glow-cyan transition-all hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-40 disabled:hover:translate-y-0 disabled:hover:shadow-none"
              >
                START SESSION →
              </button>
              <button
                onClick={onClose}
                className="text-xs font-mono text-flow-muted border border-dashed border-[#2A2A2A] rounded-lg px-4 py-3 hover:bg-flow-elevated transition-colors"
              >
                Cancel
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
