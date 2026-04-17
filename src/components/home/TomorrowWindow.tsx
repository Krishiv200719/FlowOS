import { useState } from 'react';
import { motion } from 'framer-motion';

interface TomorrowWindowProps {
  window: string;
}

export default function TomorrowWindow({ window: focusWindow }: TomorrowWindowProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(`Focus session: ${focusWindow}`).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <motion.div
      className="px-5 py-4 rounded-lg border border-[#1C1C1C] bg-[#0D0D0D]"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.55 }}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[9px] font-mono uppercase tracking-widest text-[#444] mb-1">Tomorrow's Window</p>
          <p className="text-base font-bold font-mono text-white">{focusWindow}</p>
          <p className="text-[10px] text-[#333] mt-1">based on your peak hours pattern</p>
        </div>
        <button
          onClick={handleCopy}
          className="text-[10px] font-mono text-[#444] border border-[#1C1C1C] rounded px-3 py-1.5 hover:text-flow-cyan hover:border-flow-cyan/30 transition-all"
        >
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
    </motion.div>
  );
}
