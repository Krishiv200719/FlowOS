import { motion } from 'framer-motion';

interface TomorrowWindowProps {
  window: string;
}

export default function TomorrowWindow({ window }: TomorrowWindowProps) {
  const isLocked = window === 'Complete more sessions to unlock';

  return (
    <motion.div
      className="card-dashed px-5 py-5"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.5 }}
    >
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xs font-mono uppercase tracking-widest text-flow-muted">
          Optimal Focus Window
        </span>
      </div>

      {isLocked ? (
        <div className="text-sm text-flow-very-muted">
          <span className="mr-2">🔒</span>
          {window}
        </div>
      ) : (
        <>
          <p className="text-xl font-bold text-white mb-1">
            Tomorrow: <span className="text-flow-cyan">{window}</span>
          </p>
          <p className="text-xs text-flow-muted mb-4">
            Based on your last 7 sessions, this is when your focus is strongest.
          </p>
          <button
            className="text-xs font-mono text-flow-cyan border border-dashed border-flow-cyan/30 rounded px-3 py-1.5 hover:bg-flow-cyan/5 transition-colors"
            onClick={() => {
              const text = `Focus Session\nTime: ${window}\nPowered by FlowOS`;
              navigator.clipboard.writeText(text);
            }}
          >
            📋 Copy to calendar
          </button>
        </>
      )}
    </motion.div>
  );
}
