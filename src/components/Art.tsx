import { useState } from 'react'

interface Props {
  /** Preferred image. Undefined goes straight to the fallback. */
  src: string | undefined
  /** Generated artwork, always available — see lib/poster. */
  fallback: string
  alt: string
  className?: string
  loading?: 'eager' | 'lazy'
  decoding?: 'async' | 'sync' | 'auto'
  fetchPriority?: 'high' | 'low' | 'auto'
}

/**
 * Artwork that cannot break.
 *
 * A catalogue entry may name an image that is not there — a poster dropped in
 * `public/` that was never added, a remote file moved or blocked. The browser
 * draws its own broken-image glyph for that, which looks like a bug in the
 * site. One failure swaps in the generated artwork instead, which is always
 * available because it is drawn from the entry's own id.
 */
export function Art({ src, fallback, ...rest }: Props) {
  const [failed, setFailed] = useState(false)
  const chosen = !src || failed ? fallback : src

  return (
    <img
      src={chosen}
      onError={() => { if (!failed) setFailed(true) }}
      {...rest}
    />
  )
}
