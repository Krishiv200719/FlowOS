import { motion } from 'framer-motion';

interface HeatmapGridProps {
  data: number[][]; // 7 (days) × 24 (hours), values 0-1 or -1 for no data
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const HOURS = Array.from({ length: 24 }, (_, i) => i);
const HOUR_LABELS = [6, 9, 12, 15, 18, 21];

function getCellColor(value: number): string {
  if (value < 0) return '#111111'; // no data
  if (value === 0) return '#1C1C1C';
  // Interpolate from dark to cyan
  const intensity = Math.min(value, 1);
  const r = Math.round(0 + intensity * 0);
  const g = Math.round(28 + intensity * (245 - 28));
  const b = Math.round(28 + intensity * (255 - 28));
  return `rgb(${r}, ${g}, ${b})`;
}

export default function HeatmapGrid({ data }: HeatmapGridProps) {
  return (
    <div>
      <h3 className="text-xs font-mono uppercase tracking-widest text-flow-muted mb-4">
        When You Focus Best
      </h3>

      <div className="overflow-x-auto">
        <div className="inline-block">
          {/* Hour labels */}
          <div className="flex ml-10 mb-1">
            {HOURS.map((h) => (
              <div
                key={h}
                className="text-center"
                style={{ width: '18px', minWidth: '18px' }}
              >
                {HOUR_LABELS.includes(h) && (
                  <span className="text-[9px] text-flow-very-muted font-mono">
                    {h > 12 ? `${h - 12}p` : h === 12 ? '12p' : `${h}a`}
                  </span>
                )}
              </div>
            ))}
          </div>

          {/* Grid rows */}
          {DAYS.map((day, dayIdx) => (
            <div key={day} className="flex items-center gap-1.5 mb-[2px]">
              <span className="text-[10px] text-flow-very-muted font-mono w-8 text-right">
                {day}
              </span>
              <div className="flex gap-[2px]">
                {HOURS.map((hour) => {
                  const value = data[dayIdx]?.[hour] ?? -1;
                  return (
                    <motion.div
                      key={hour}
                      className="rounded-[2px] cursor-default"
                      style={{
                        width: '16px',
                        height: '16px',
                        backgroundColor: getCellColor(value),
                      }}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{
                        delay: dayIdx * 0.03 + hour * 0.005,
                      }}
                      title={
                        value >= 0
                          ? `${day} ${hour}:00 — ${Math.round(value * 100)}% focus`
                          : `${day} ${hour}:00 — No data`
                      }
                    />
                  );
                })}
              </div>
            </div>
          ))}

          {/* Color legend */}
          <div className="flex items-center gap-2 mt-3 ml-10">
            <span className="text-[9px] text-flow-very-muted font-mono">
              Less
            </span>
            {[0, 0.25, 0.5, 0.75, 1].map((v) => (
              <div
                key={v}
                className="w-3 h-3 rounded-[2px]"
                style={{ backgroundColor: getCellColor(v) }}
              />
            ))}
            <span className="text-[9px] text-flow-very-muted font-mono">
              More
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
