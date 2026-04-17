// ═══════════════════════════════════════════════════════════
// FlowOS — Shared Page Transition Variants (Upgrade #10)
// ═══════════════════════════════════════════════════════════

export const pageVariants = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.25, ease: 'easeOut' } },
  exit: { opacity: 0, y: -8, transition: { duration: 0.15, ease: 'easeIn' } },
};
