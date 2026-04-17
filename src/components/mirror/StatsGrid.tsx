import { motion } from 'framer-motion';

interface StatsGridProps {
  realFocusMin: number;
  timeLostMin: number;
  tabSwitches: number;
  avgRecoveryMin: number;
  plannedMin: number;
  distractionMin: number;
  trueCostPerDist: number;
  recoverySecActual: number;
}

export default function StatsGrid({
  realFocusMin, timeLostMin, tabSwitches, plannedMin,
  distractionMin, trueCostPerDist, recoverySecActual,
}: StatsGridProps) {
  const stats = [
    {
      label: 'Real Focus Time',
      value: realFocusMin,
      unit: 'min',
      subtext: `of ${plannedMin} min planned`,
      color: '#00F5FF',
      accent: false,
    },
    {
      label: 'Time Lost',
      value: timeLostMin,
      unit: 'min',
      subtext: 'distractions + idle',
      color: '#FF3B3B',
      accent: false,
    },
    {
      label: 'Tab Switches',
      value: tabSwitches,
      unit: 'times',
      subtext: 'interruptions tracked',
      color: '#FF6B35',
      accent: false,
    },
    {
      label: 'True Cost / Distraction',
      value: trueCostPerDist,
      unit: 'min',
      subtext: `${recoverySecActual}s recovery overhead`,
      color: '#888',
      accent: true,
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3">
      {stats.map((stat, i) => (
        <motion.div
          key={stat.label}
          className={`px-5 py-4 rounded-lg border ${stat.accent ? 'border-[#FF6B35]/20 bg-[#110E00]' : 'border-[#1C1C1C] bg-[#0D0D0D]'}`}
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.15 + i * 0.07 }}
        >
          <p className="text-[9px] font-mono uppercase tracking-widest text-[#444] mb-3">{stat.label}</p>
          <p className="text-3xl font-bold font-mono leading-none" style={{ color: stat.color }}>
            {stat.value}
            <span className="text-sm ml-1 font-normal" style={{ color: stat.color, opacity: 0.5 }}>{stat.unit}</span>
          </p>
          <p className="text-[10px] text-[#333] mt-2">{stat.subtext}</p>
        </motion.div>
      ))}
    </div>
  );
}
