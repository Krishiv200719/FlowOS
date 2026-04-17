import { motion } from 'framer-motion';
import type { AIInsights } from '../../types';

interface FocusDNAProps {
  insights: AIInsights;
}

const trendColors = { improving: '#00D46A', declining: '#FF3B3B', stable: '#FF6B35' };

const ratioLabel = (r: number) => {
  if (r >= 0.7) return { text: 'GREAT', color: '#00D46A' };
  if (r >= 0.5) return { text: 'FAIR',  color: '#FF6B35' };
  if (r >= 0.3) return { text: 'POOR',  color: '#FF3B3B' };
  return            { text: 'CRITICAL', color: '#FF3B3B' };
};

export default function FocusDNA({ insights }: FocusDNAProps) {
  const focusLabel = ratioLabel(insights.realFocusRatio);
  const focusPct   = Math.round(insights.realFocusRatio * 100);
  const trendColor = trendColors[insights.weeklyTrend] ?? '#FF6B35';

  return (
    <div className="space-y-3">

      {/* Peak Hours + Trend */}
      <motion.div
        className="flex items-center justify-between px-5 py-4 rounded-lg border border-[#1C1C1C] bg-[#0D0D0D]"
        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
      >
        <div>
          <p className="text-[9px] font-mono uppercase tracking-widest text-[#444] mb-1">Peak Focus Hours</p>
          <p className="text-xl font-bold font-mono text-flow-cyan">{insights.peakHours}</p>
        </div>
        <span
          className="text-[9px] font-mono px-2 py-1 rounded border"
          style={{ color: trendColor, borderColor: `${trendColor}30`, background: `${trendColor}10` }}
        >
          {insights.weeklyTrend.toUpperCase()}
        </span>
      </motion.div>

      {/* Focus Ratio Bar */}
      <motion.div
        className="px-5 py-4 rounded-lg border border-[#1C1C1C] bg-[#0D0D0D]"
        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18 }}
      >
        <div className="flex items-center justify-between mb-3">
          <p className="text-[9px] font-mono uppercase tracking-widest text-[#444]">Real Focus Ratio</p>
          <span
            className="text-[9px] font-mono font-bold px-2 py-0.5 rounded"
            style={{ color: focusLabel.color, background: `${focusLabel.color}15` }}
          >
            {focusLabel.text}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-2xl font-bold font-mono text-white">{focusPct}%</span>
          <div className="flex-1 relative">
            <div className="h-1.5 bg-[#1C1C1C] rounded-full overflow-hidden">
              <motion.div
                className="h-full rounded-full"
                style={{ backgroundColor: focusLabel.color }}
                initial={{ width: 0 }}
                animate={{ width: `${focusPct}%` }}
                transition={{ duration: 0.9, delay: 0.3, ease: 'easeOut' }}
              />
            </div>
            {/* 70% target marker */}
            <div className="absolute top-0 bottom-0 w-px bg-[#333]" style={{ left: '70%' }} />
            <div className="absolute -top-4 text-[8px] font-mono text-[#333]" style={{ left: '70%', transform: 'translateX(-50%)' }}>
              70%
            </div>
          </div>
        </div>
      </motion.div>

      {/* Top Distractor */}
      <motion.div
        className="px-5 py-4 rounded-lg border border-[#1C1C1C] bg-[#0D0D0D]"
        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
      >
        <p className="text-[9px] font-mono uppercase tracking-widest text-[#444] mb-2">Top Distractor</p>
        <p className="text-base font-bold text-flow-red">{insights.topDistractor}</p>
        <p className="text-[10px] text-[#333] mt-1">avg stolen per session</p>
      </motion.div>

      {/* Key Insight */}
      <motion.div
        className="px-5 py-4 rounded-lg bg-[#080E0E]"
        style={{ borderLeft: '2px solid #00F5FF', border: '1px solid rgba(0,245,255,0.1)', borderLeftWidth: '2px' }}
        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.32 }}
      >
        <p className="text-[9px] font-mono uppercase tracking-widest text-flow-cyan mb-2">Key Insight</p>
        <p className="text-sm text-white leading-relaxed">{insights.keyInsight}</p>
      </motion.div>

      {/* Coach Message */}
      <motion.div
        className="px-5 py-4 rounded-lg bg-[#080F08] border border-[#00D46A]/10"
        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
      >
        <p className="text-[9px] font-mono uppercase tracking-widest text-flow-green mb-2">Coach</p>
        <p className="text-sm text-flow-green leading-relaxed font-mono">
          {insights.coachMessage}
          <span className="inline-block w-2 h-4 bg-flow-green ml-1 animate-pulse" />
        </p>
      </motion.div>

      {/* Tomorrow Window */}
      {insights.tomorrowWindow && (
        <motion.div
          className="px-5 py-4 rounded-lg border border-flow-cyan/10 bg-[#080E0E] flex items-center justify-between"
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.48 }}
        >
          <div>
            <p className="text-[9px] font-mono uppercase tracking-widest text-flow-cyan mb-1">Lock In Tomorrow</p>
            <p className="text-[11px] text-[#555]">optimal focus window</p>
          </div>
          <div className="text-right">
            <p className="text-lg font-bold font-mono text-white">{insights.tomorrowWindow}</p>
            <p className="text-[9px] text-[#333] font-mono">protect this time</p>
          </div>
        </motion.div>
      )}
    </div>
  );
}
