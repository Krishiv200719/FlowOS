import { motion } from 'framer-motion';
import type { AIInsights } from '../../types';

interface FocusDNAProps {
  insights: AIInsights;
}

export default function FocusDNA({ insights }: FocusDNAProps) {
  return (
    <div className="space-y-5">
      {/* Peak Hours */}
      <motion.div
        className="card-dashed px-5 py-4"
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.1 }}
      >
        <p className="text-[10px] font-mono uppercase tracking-widest text-flow-muted mb-1">
          Peak Hours
        </p>
        <p className="text-xl font-bold text-flow-cyan">{insights.peakHours}</p>
      </motion.div>

      {/* Focus Ratio */}
      <motion.div
        className="card-dashed px-5 py-4"
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.2 }}
      >
        <p className="text-[10px] font-mono uppercase tracking-widest text-flow-muted mb-2">
          Your Real Focus Ratio
        </p>
        <div className="flex items-center gap-3">
          <span className="text-2xl font-bold font-mono text-white">
            {Math.round(insights.realFocusRatio * 100)}%
          </span>
          <div className="flex-1 h-2 bg-flow-elevated rounded-full overflow-hidden">
            <motion.div
              className="h-full rounded-full"
              style={{
                backgroundColor:
                  insights.realFocusRatio < 0.4
                    ? '#FF3B3B'
                    : insights.realFocusRatio < 0.7
                    ? '#FF6B35'
                    : '#00D46A',
              }}
              initial={{ width: 0 }}
              animate={{ width: `${insights.realFocusRatio * 100}%` }}
              transition={{ duration: 0.8, delay: 0.3 }}
            />
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
        <p className="text-[10px] font-mono uppercase tracking-widest text-flow-muted mb-1">
          Top Distractor
        </p>
        <p className="text-sm text-flow-red font-medium">
          {insights.topDistractor}
        </p>
      </motion.div>

      {/* Key Insight — highlighted */}
      <motion.div
        className="bg-flow-card border-l-2 border-flow-cyan rounded-r-lg px-5 py-4"
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.4 }}
      >
        <p className="text-[10px] font-mono uppercase tracking-widest text-flow-cyan mb-2">
          Key Insight
        </p>
        <p className="text-sm text-white leading-relaxed">
          {insights.keyInsight}
        </p>
      </motion.div>

      {/* Coach Message */}
      <motion.div
        className="text-center py-4"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
      >
        <p className="text-[10px] font-mono uppercase tracking-widest text-flow-muted mb-2">
          Coach Message
        </p>
        <p className="text-base italic text-flow-muted leading-relaxed max-w-md mx-auto">
          "{insights.coachMessage}"
        </p>
      </motion.div>
    </div>
  );
}
