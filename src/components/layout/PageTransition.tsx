import type { ReactNode } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { transitionsDeVue } from '@/lib/transitions'

/**
 * One short crossfade between routes. Deliberately quiet — the page content
 * is the thing to look at, not the way it arrived.
 *
 * Là où le navigateur sait faire des transitions de vue, ce fondu s'efface :
 * il ferait un second mouvement par-dessus le sien, et deux animations qui
 * se superposent donnent toujours l'impression que le site rame.
 */
export function PageTransition({ children }: { children: ReactNode }) {
  const reduced = useReducedMotion()

  if (transitionsDeVue) return <main>{children}</main>

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
