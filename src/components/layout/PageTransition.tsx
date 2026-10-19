import type { ReactNode } from 'react'
import { motion, useReducedMotion } from 'motion/react'

/**
 * One short crossfade between routes. Deliberately quiet — the page content
 * is the thing to look at, not the way it arrived.
 */
export function PageTransition({ children }: { children: ReactNode }) {
  const reduced = useReducedMotion()
  return (
    <motion.main
      initial={{ opacity: 0, y: reduced ? 0 : 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{
        duration: reduced ? 0 : 0.26,
        ease: [0.22, 1, 0.36, 1],
        opacity: { duration: reduced ? 0 : 0.2 },
      }}
    >
      {children}
    </motion.main>
  )
}
