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

export default function SessionTimeline({
  events,
  totalDuration,
}: SessionTimelineProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  // Filter out zero-duration events for rendering
  const visibleEvents = events.filter(
    (e) => e.type !== 'tab_switch' && (e.duration || 0) > 0
  );

  return (
    <div className="space-y-4">
      <h3 className="text-xs font-mono uppercase tracking-widest text-flow-muted">
        Your Session Timeline
      </h3>

      {/* Timeline Bar */}
      <div className="relative">
        <div className="flex h-10 rounded-md overflow-hidden border border-flow-border">
          {visibleEvents.map((event, i) => {
            const widthPercent =
              totalDuration > 0
                ? ((event.duration || 0) / totalDuration) * 100
                : 0;

            if (widthPercent < 0.5) return null;

            return (
              <motion.div
                key={i}
                className="relative h-full cursor-pointer transition-opacity"
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{
                  duration: 0.3,
                  delay: i * 0.05,
                  ease: 'easeOut',
                }}
                style={{
                  width: `${widthPercent}%`,
                  backgroundColor: eventColors[event.type] || '#444',
                  minWidth: '2px',
                  opacity: hoveredIndex !== null && hoveredIndex !== i ? 0.4 : 1,
                  transformOrigin: 'left',
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
                        <p className="text-[10px] text-flow-muted">
                          {event.domain}
                        </p>
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
        </div>
      </div>

      {/* Legend */}
      <div className="flex gap-5">
        {['focus', 'idle', 'distraction'].map((type) => (
          <div key={type} className="flex items-center gap-2">
            <div
              className="w-2.5 h-2.5 rounded-full"
              style={{ backgroundColor: eventColors[type] }}
            />
            <span className="text-xs text-flow-muted">
              {eventLabels[type]}
            </span>
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
