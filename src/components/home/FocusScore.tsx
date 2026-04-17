import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';

interface FocusScoreProps {
  score: number;
}

export default function FocusScore({ score }: FocusScoreProps) {
  const [displayScore, setDisplayScore] = useState(0);
  const frameRef = useRef<number>(0);

  // Animate count-up
  useEffect(() => {
    const start = performance.now();
    const duration = 1200;

    function animate(now: number) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayScore(Math.round(eased * score));

      if (progress < 1) {
        frameRef.current = requestAnimationFrame(animate);
      }
    }

    frameRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frameRef.current);
  }, [score]);

  const scoreColor =
    score < 40 ? '#FF3B3B' : score < 70 ? '#FF6B35' : '#00F5FF';

  // SVG ring
  const size = 180;
  const strokeWidth = 6;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - score / 100);

  return (
    <motion.div
      className="flex flex-col items-center"
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5 }}
    >
      <div className="relative" style={{ width: size, height: size }}>
        {/* Background ring */}
        <svg
          width={size}
          height={size}
          className="absolute inset-0"
          style={{ transform: 'rotate(-90deg)' }}
        >
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="#1C1C1C"
            strokeWidth={strokeWidth}
          />
          <motion.circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={scoreColor}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset }}
            transition={{ duration: 1.2, ease: 'easeOut', delay: 0.2 }}
            style={{
              filter: `drop-shadow(0 0 8px ${scoreColor}40)`,
            }}
          />
        </svg>

        {/* Score number */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span
            className="text-5xl font-bold font-mono leading-none"
            style={{ color: scoreColor }}
          >
            {displayScore}
          </span>
          <span className="text-xs text-flow-muted font-mono uppercase tracking-widest mt-1">
            Focus Score
          </span>
        </div>
      </div>
    </motion.div>
  );
}
