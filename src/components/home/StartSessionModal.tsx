// ═══════════════════════════════════════════════════════════
// FlowOS — Start Session Modal
// Modal overlay to initiate a new focus session.
// ═══════════════════════════════════════════════════════════

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSessionContext } from '../../context/SessionContext';

interface StartSessionModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function StartSessionModal({ isOpen, onClose }: StartSessionModalProps) {
  const { extensionConnected } = useSessionContext();
  const [goal, setGoal] = useState('');
  const [duration, setDuration] = useState(60);
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

  const handleStart = () => {
    if (!goal.trim()) return;

    // If extension connected, message the extension
    if (extensionConnected) {
      window.postMessage(
        {
          source: 'flowos-dashboard',
          action: 'START_SESSION',
          goal: goal.trim(),
          plannedDuration: duration,
        },
        '*'
      );
    }

    // Store active session in localStorage
    localStorage.setItem(
      'flowos_active_session',
      JSON.stringify({
        goal: goal.trim(),
        plannedDuration: duration,
        startedAt: Date.now(),
      })
    );

    // Reset and close
    setGoal('');
    setDuration(60);
    onClose();

    // Force re-render to show the active session timer
    window.dispatchEvent(new Event('flowos-session-started'));
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={(e) => {
            if (e.target === e.currentTarget) onClose();
          }}
        >
          <motion.div
            className="card-dashed px-8 py-8 w-full max-w-md space-y-6"
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.2 }}
          >
            {/* Title */}
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
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleStart();
                }}
                placeholder="e.g., Build dashboard component"
                className="w-full bg-flow-elevated border border-[#2A2A2A] rounded-lg px-4 py-3 text-sm text-white placeholder-flow-very-muted font-mono focus:outline-none focus:border-flow-cyan/50 transition-colors"
              />
            </div>

            {/* Duration Slider */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-mono uppercase tracking-widest text-flow-muted">
                  Planned Duration
                </label>
                <span className="text-sm font-mono text-flow-cyan">
                  {duration} MIN
                </span>
              </div>
              <input
                type="range"
                min={15}
                max={180}
                step={15}
                value={duration}
                onChange={(e) => setDuration(parseInt(e.target.value))}
                className="w-full h-1 bg-flow-elevated rounded-full appearance-none cursor-pointer accent-[#00F5FF]"
              />
              <div className="flex justify-between text-[9px] font-mono text-flow-very-muted">
                <span>15</span>
                <span>60</span>
                <span>120</span>
                <span>180</span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={handleStart}
                disabled={!goal.trim()}
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
