import { motion } from 'framer-motion';

interface StatItem {
  label: string;
  value: string;
  color: string;
  subtext?: string;
}

interface StatsGridProps {
  realFocusMin: number;
  timeLostMin: number;
  tabSwitches: number;
  avgRecoveryMin: number;
}

export default function StatsGrid({
  realFocusMin,
  timeLostMin,
  tabSwitches,
  avgRecoveryMin,
}: StatsGridProps) {
  const stats: StatItem[] = [
    {
      label: 'Real Focus Time',
      value: `${realFocusMin} min`,
      color: '#00F5FF',
    },
    {
      label: 'Time Lost',
      value: `${timeLostMin} min`,
      color: '#FF3B3B',
    },
    {
      label: 'Tab Switches',
      value: `${tabSwitches} times`,
      color: '#FF6B35',
    },
    {
      label: 'Recovery Cost',
      value: `${avgRecoveryMin} min`,
      color: '#888888',
      subtext: 'avg to refocus',
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3">
      {stats.map((stat, i) => (
        <motion.div
          key={stat.label}
          className="card-dashed px-4 py-4"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 + i * 0.08 }}
        >
          <p
            className="text-2xl font-bold font-mono leading-none mb-1"
            style={{ color: stat.color }}
          >
            {stat.value}
          </p>
          <p className="text-[10px] font-mono uppercase tracking-wider text-flow-muted">
            {stat.label}
          </p>
          {stat.subtext && (
            <p className="text-[10px] text-flow-very-muted mt-0.5">
              {stat.subtext}
            </p>
          )}
        </motion.div>
      ))}
    </div>
  );
}
