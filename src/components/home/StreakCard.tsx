import { motion } from 'framer-motion';

interface StreakCardProps {
  streak: number;
}

export default function StreakCard({ streak }: StreakCardProps) {
  return (
    <motion.div
      className="card-dashed px-5 py-4 flex items-center gap-3"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
    >
      <span className="text-2xl">
        {streak > 0 ? '🔥' : '💤'}
      </span>
      <div>
        {streak > 0 ? (
          <>
            <p className="text-lg font-bold text-white">
              <span className="font-mono text-flow-orange">{streak}</span> day streak
            </p>
            <p className="text-xs text-flow-muted">
              Keep going — consistency beats intensity.
            </p>
          </>
        ) : (
          <>
            <p className="text-sm font-medium text-flow-muted">
              Start your streak
            </p>
            <p className="text-xs text-flow-very-muted">
              Complete a session with &gt;50% focus to begin.
            </p>
          </>
        )}
      </div>
    </motion.div>
  );
}
