import { motion } from 'framer-motion';
import type { FocusSession } from '../../types';

interface StreakCardProps {
  streak: number;
  sessions: FocusSession[];
}

export default function StreakCard({ streak, sessions }: StreakCardProps) {
  const now = new Date();
  const days: { label: string; date: Date; pct: number | null; hasFocus: boolean }[] = [];

  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    const daySessions = sessions.filter(s => {
      const sd = new Date(s.startTime);
      return `${sd.getFullYear()}-${sd.getMonth()}-${sd.getDate()}` === key;
    });
    const best = daySessions.length > 0 ? Math.max(...daySessions.map(s => s.stats.focusRatio)) : null;
    days.push({
      label: d.toLocaleDateString('en-US', { weekday: 'short' }),
      date: d,
      pct: best !== null ? Math.round(best * 100) : null,
      hasFocus: best !== null && best > 0.5,
    });
  }

  return (
    <motion.div
      className="px-5 py-4 rounded-lg border border-[#1C1C1C] bg-[#0D0D0D]"
      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
    >
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-[9px] font-mono uppercase tracking-widest text-[#444] mb-1">Streak</p>
          <p className="text-sm font-bold text-white">
            {streak > 0 ? (
              <><span className="font-mono text-flow-orange">{streak}</span> {streak === 1 ? 'day' : 'days'}</>
            ) : (
              <span className="text-[#444]">—</span>
            )}
          </p>
        </div>
      </div>

      {/* 7-day squares */}
      <div className="flex gap-1.5">
        {days.map((day, i) => (
          <div key={i} className="flex flex-col items-center gap-1 group relative">
            <div
              className="w-5 h-5 rounded-sm transition-all duration-200 group-hover:scale-110"
              style={{
                backgroundColor: day.hasFocus ? '#00F5FF' :
                  day.pct !== null ? 'rgba(255,107,53,0.4)' : '#111',
                boxShadow: day.hasFocus ? '0 0 6px rgba(0,245,255,0.3)' : 'none',
              }}
            />
            <span className="text-[8px] font-mono text-[#333]">{day.label.slice(0, 1)}</span>
            {/* Tooltip */}
            <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
              <div className="bg-[#111] border border-[#222] rounded px-2 py-1 whitespace-nowrap">
                <p className="text-[9px] font-mono text-white">
                  {day.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </p>
                <p className="text-[9px] font-mono text-[#555]">
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
