import { motion } from 'framer-motion';
import { getDistractorColor } from '../../lib/distractions';

interface TopDistractorsProps {
  distractors: { domain: string; seconds: number }[];
}

export default function TopDistractors({ distractors }: TopDistractorsProps) {
  if (distractors.length === 0) return null;

  const maxSeconds = distractors[0]?.seconds || 1;

  return (
    <div>
      <h3 className="text-xs font-mono uppercase tracking-widest text-flow-muted mb-3">
        Top Distractors
      </h3>
      <div className="space-y-2.5">
        {distractors.map((d, i) => {
          const min = Math.floor(d.seconds / 60);
          const sec = d.seconds % 60;
          const timeStr =
            min > 0 ? `${min} min ${sec > 0 ? sec + 's' : ''}` : `${sec}s`;
          const barWidth = (d.seconds / maxSeconds) * 100;

          return (
            <motion.div
              key={d.domain}
              className="relative"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4 + i * 0.08 }}
            >
              {/* Background bar */}
              <div className="absolute inset-0 rounded-md overflow-hidden">
                <div
                  className="h-full rounded-md opacity-10"
                  style={{
                    width: `${barWidth}%`,
                    backgroundColor: getDistractorColor(d.domain),
                  }}
                />
              </div>

              {/* Content */}
              <div className="relative flex items-center justify-between px-3 py-2">
                <div className="flex items-center gap-2.5">
                  <div
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{
                      backgroundColor: getDistractorColor(d.domain),
                    }}
                  />
                  <span className="text-sm text-white">{d.domain}</span>
                </div>
                <span className="text-sm font-mono text-flow-muted">
                  {timeStr}
                </span>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
