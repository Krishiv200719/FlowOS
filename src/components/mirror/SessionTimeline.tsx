import { useState } from 'react';
import { motion } from 'framer-motion';
import type { SessionEvent } from '../../types';

interface SessionTimelineProps {
  events: SessionEvent[];
  totalDuration: number; // ms
}

const eventColors: Record<string, string> = {
  focus: '#00D46A',
  idle: '#FF6B35',
  distraction: '#FF3B3B',
  tab_switch: '#888888',
  return: '#00F5FF',
};

const eventLabels: Record<string, string> = {
  focus: 'Deep Focus',
  idle: 'Idle',
  distraction: 'Distraction',
  tab_switch: 'Tab Switch',
};

export default function SessionTimeline({ events, totalDuration }: SessionTimelineProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const visibleEvents = events.filter(
    (e) => e.type !== 'tab_switch' && (e.duration || 0) > 0
  );

  // Time markers
  const sessionMinutes = Math.round(totalDuration / 60000);
  const markerInterval = sessionMinutes <= 30 ? 10 : sessionMinutes <= 60 ? 15 : 30;
  const markers: number[] = [];
  for (let m = 0; m <= sessionMinutes; m += markerInterval) {
    markers.push(m);
  }

  // Start/end times from first event
  const startTime = events[0]?.timestamp ?? 0;
  const endTime = startTime + totalDuration;
  const fmt = (ts: number) =>
    new Date(ts).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

  return (
    <div className="space-y-3">
      <h3 className="text-xs font-mono uppercase tracking-widest text-flow-muted">
        Your Session Timeline
      </h3>

      {/* BUG #5 FIX: Reveal wrapper for left→right animation */}
      <div className="relative overflow-hidden rounded-md">
        <motion.div
          className="flex h-10 rounded-md overflow-hidden border border-flow-border"
          initial={{ width: 0 }}
          animate={{ width: '100%' }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
        >
          {visibleEvents.map((event, i) => {
            const widthPercent =
              totalDuration > 0 ? ((event.duration || 0) / totalDuration) * 100 : 0;
            if (widthPercent < 0.5) return null;

            return (
              <motion.div
                key={i}
                className="relative h-full cursor-pointer"
                // BUG #5 FIX: opacity-only, no scaleX
                initial={{ opacity: 0 }}
                animate={{ opacity: hoveredIndex !== null && hoveredIndex !== i ? 0.4 : 1 }}
                transition={{ duration: 0.2, delay: i * 0.04 }}
                style={{
                  width: `${widthPercent}%`,
                  backgroundColor: eventColors[event.type] || '#444',
                  minWidth: '2px',
                }}
                onMouseEnter={() => setHoveredIndex(i)}
                onMouseLeave={() => setHoveredIndex(null)}
              >
                {/* Tooltip */}
                {hoveredIndex === i && (
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50">
                    <div className="bg-flow-card border border-flow-border rounded-md px-3 py-2 shadow-lg whitespace-nowrap">
                      <p className="text-xs font-medium text-white">
                        {eventLabels[event.type] || event.type}
                      </p>
                      {event.domain && (
                        <p className="text-[10px] text-flow-muted">{event.domain}</p>
                      )}
                      <p className="text-[10px] font-mono text-flow-cyan">
                        {formatMs(event.duration || 0)}
                      </p>
                    </div>
                    <div className="w-2 h-2 bg-flow-card border-r border-b border-flow-border rotate-45 mx-auto -mt-1" />
                  </div>
                )}
              </motion.div>
            );
          })}
        </motion.div>
      </div>

      {/* DESIGN #6: Time markers below bar */}
      <div className="relative flex items-start" style={{ height: '20px' }}>
        <span className="absolute left-0 text-[9px] font-mono text-flow-very-muted">{fmt(startTime)}</span>
        {markers.slice(1, -1).map((m) => (
          <span
            key={m}
            className="absolute text-[9px] font-mono text-flow-very-muted -translate-x-1/2"
            style={{ left: `${(m / sessionMinutes) * 100}%` }}
          >
            {m}m
          </span>
        ))}
        <span className="absolute right-0 text-[9px] font-mono text-flow-very-muted">{fmt(endTime)}</span>
      </div>

      {/* Legend */}
      <div className="flex gap-5">
        {['focus', 'idle', 'distraction'].map((type) => (
          <div key={type} className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: eventColors[type] }} />
            <span className="text-xs text-flow-muted">{eventLabels[type]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function formatMs(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  if (min === 0) return `${sec}s`;
  return sec > 0 ? `${min}m ${sec}s` : `${min}m`;
}
