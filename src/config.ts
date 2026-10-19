/**
 * Everything you would want to change before showing this to anyone.
 */
export const SITE = {
  /** Shown in the navigation bar and the browser tab. */
  name: 'Lucarne',
  /** One line in the footer. */
  purpose: 'Bibliothèque privée, partagée entre proches.',
} as const

/** Profile avatar tints, cycled in the order profiles are created. */
export const PROFILE_TINTS = [
  '#F2A93B', '#4FB3A3', '#D1563F', '#7B87D6', '#BFE83F', '#FFB487',
] as const
