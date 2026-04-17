import { motion } from 'framer-motion';
import type { FocusSession } from '../../types';

interface StreakCardProps {
  streak: number;
  sessions: FocusSession[];
}

// UPGRADE #9: Visual streak squares for last 7 days
export default function StreakCard({ streak, sessions }: StreakCardProps) {
  const days: { label: string; date: Date; hasFocus: boolean; pct: number | null }[] = [];
  const now = new Date();

  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

    const daySessions = sessions.filter((s) => {
      const sd = new Date(s.startTime);
      return `${sd.getFullYear()}-${sd.getMonth()}-${sd.getDate()}` === key;
    });

    const bestRatio =
      daySessions.length > 0
        ? Math.max(...daySessions.map((s) => s.stats.focusRatio))
        : null;

    days.push({
      label: d.toLocaleDateString('en-US', { weekday: 'short' }),
      date: d,
      hasFocus: bestRatio !== null && bestRatio > 0.5,
      pct: bestRatio !== null ? Math.round(bestRatio * 100) : null,
    });
  }

  return (
    <motion.div
      className="card-dashed px-5 py-4"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xl">{streak > 0 ? '🔥' : '💤'}</span>
          <div>
            {streak > 0 ? (
              <p className="text-sm font-bold text-white">
                <span className="font-mono text-flow-orange">{streak}</span> day streak
              </p>
            ) : (
              <p className="text-sm font-medium text-flow-muted">Start your streak</p>
            )}
            <p className="text-[10px] text-flow-very-muted">
              {streak > 0 ? 'Keep going.' : '>50% focus to begin.'}
            </p>
          </div>
        </div>
      </div>

      {/* 7-day grid */}
      <div className="flex gap-1">
        {days.map((day, i) => (
          <div key={i} className="flex flex-col items-center gap-1 group relative">
            <div
              className={`w-5 h-5 rounded-sm transition-all duration-200 group-hover:scale-110 ${
                day.hasFocus
                  ? 'bg-flow-cyan shadow-glow-cyan'
                  : day.pct !== null
                  ? 'bg-flow-orange/60'
                  : 'bg-[#1C1C1C]'
              }`}
            />
            <span className="text-[9px] font-mono text-flow-very-muted">{day.label.slice(0, 1)}</span>
            {/* Tooltip */}
            <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
              <div className="bg-flow-card border border-flow-border rounded px-2 py-1 whitespace-nowrap">
                <p className="text-[9px] font-mono text-white">
                  {day.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </p>
                <p className="text-[9px] font-mono text-flow-muted">
                  {day.pct !== null ? `${day.pct}% focus` : 'no session'}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
}
