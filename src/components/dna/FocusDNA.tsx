import { motion } from 'framer-motion';
import type { AIInsights } from '../../types';

interface FocusDNAProps {
  insights: AIInsights;
}

const trendColors = {
  improving: '#00D46A',
  declining: '#FF3B3B',
  stable: '#FF6B35',
};

const ratioLabel = (ratio: number) => {
  if (ratio >= 0.7) return { text: 'GREAT', color: '#00D46A' };
  if (ratio >= 0.5) return { text: 'FAIR', color: '#FF6B35' };
  if (ratio >= 0.3) return { text: 'POOR', color: '#FF3B3B' };
  return { text: 'CRITICAL', color: '#FF3B3B' };
};

export default function FocusDNA({ insights }: FocusDNAProps) {
  const focusLabel = ratioLabel(insights.realFocusRatio);
  const focusPct = Math.round(insights.realFocusRatio * 100);
  const trendColor = trendColors[insights.weeklyTrend] ?? '#FF6B35';

  return (
    <div className="space-y-4">
      {/* Peak Hours */}
      <motion.div
        className="card-dashed px-5 py-4 flex items-center justify-between"
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.1 }}
      >
        <div>
          <p className="text-[10px] font-mono uppercase tracking-widest text-flow-muted mb-1">
            🕘 Peak Focus Hours
          </p>
          <p className="text-xl font-bold text-flow-cyan">{insights.peakHours}</p>
        </div>
        <span
          className="text-[10px] font-mono px-2 py-1 rounded-full"
          style={{ color: trendColor, backgroundColor: `${trendColor}18` }}
        >
          {insights.weeklyTrend.toUpperCase()}
        </span>
      </motion.div>

      {/* Focus Ratio with ghost target */}
      <motion.div
        className="card-dashed px-5 py-4"
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.2 }}
      >
        <div className="flex items-center justify-between mb-2">
          <p className="text-[10px] font-mono uppercase tracking-widest text-flow-muted">
            📊 Your Real Focus Ratio
          </p>
          <span
            className="text-[10px] font-mono font-bold px-2 py-0.5 rounded"
            style={{ color: focusLabel.color, backgroundColor: `${focusLabel.color}15` }}
          >
            {focusLabel.text}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-2xl font-bold font-mono text-white">{focusPct}%</span>
          <div className="flex-1 relative">
            {/* Track */}
            <div className="h-2 bg-flow-elevated rounded-full overflow-hidden">
              <motion.div
                className="h-full rounded-full"
                style={{ backgroundColor: focusLabel.color }}
                initial={{ width: 0 }}
                animate={{ width: `${focusPct}%` }}
                transition={{ duration: 0.8, delay: 0.3 }}
              />
            </div>
            {/* Ghost target line at 70% */}
            <div
              className="absolute top-0 bottom-0 w-px bg-white/20"
              style={{ left: '70%' }}
              title="Target: 70%"
            />
            <div
              className="absolute -top-4 text-[8px] font-mono text-flow-very-muted"
              style={{ left: '70%', transform: 'translateX(-50%)' }}
            >
              70% target
            </div>
          </div>
        </div>
      </motion.div>

      {/* Top Distractor */}
      <motion.div
        className="card-dashed px-5 py-4"
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.3 }}
      >
        <p className="text-[10px] font-mono uppercase tracking-widest text-flow-muted mb-2">
          🎯 Top Distractor
        </p>
        <p className="text-base text-flow-red font-bold">{insights.topDistractor}</p>
        <p className="text-[10px] text-flow-very-muted mt-1">stolen per session, on average</p>
      </motion.div>

      {/* Key Insight — highlighted with pulsing border */}
      <motion.div
        className="bg-flow-card rounded-r-lg px-5 py-4"
        style={{
          borderLeft: '3px solid #00F5FF',
          boxShadow: '0 0 20px rgba(0,245,255,0.08)',
        }}
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.4 }}
      >
        <p className="text-[10px] font-mono uppercase tracking-widest text-flow-cyan mb-2">
          💡 Key Insight
        </p>
        <p className="text-sm text-white leading-relaxed font-medium">{insights.keyInsight}</p>
      </motion.div>

      {/* Coach Message — terminal style */}
      <motion.div
        className="bg-[#0D1A0D] border border-flow-green/20 rounded-lg px-5 py-4"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
      >
        <p className="text-[10px] font-mono uppercase tracking-widest text-flow-green mb-2">
          $ coach --message
        </p>
        <p className="text-sm text-flow-green leading-relaxed font-mono">
          {insights.coachMessage}
          <span className="inline-block w-2 h-4 bg-flow-green ml-1 animate-pulse" />
        </p>
      </motion.div>

      {/* UPGRADE #4: Tomorrow's Plan section */}
      {insights.tomorrowWindow && (
        <motion.div
          className="bg-gradient-to-r from-flow-cyan/10 to-transparent border border-flow-cyan/20 rounded-lg px-5 py-4 flex items-center justify-between"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
        >
          <div>
            <p className="text-[10px] font-mono uppercase tracking-widest text-flow-cyan mb-1">
              🗓 Lock This In
            </p>
            <p className="text-sm text-flow-muted">Tomorrow's optimal focus window</p>
          </div>
          <div className="text-right">
            <p className="text-lg font-bold font-mono text-white">{insights.tomorrowWindow}</p>
            <p className="text-[10px] text-flow-very-muted">protect this time</p>
          </div>
        </motion.div>
      )}
    </div>
  );
}
