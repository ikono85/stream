import { useEffect } from 'react'

/**
 * MEDIA SESSION
 * =============
 * Tells the operating system what is playing, and accepts the commands it
 * sends back: the phone's lock screen, the flyout Windows shows when the
 * media key is pressed, Now Playing on macOS, the button on a pair of
 * headphones, a car dashboard.
 *
 * Nothing here talks to the network and nothing needs an account — the
 * browser is the whole of it. Where the interface is missing, the hook does
 * nothing at all.
 *
 * One rule matters more than the rest: every handler goes through the same
 * functions as the on-screen buttons, never straight to the video element.
 * A pause from the lock screen has to reach a shared room exactly like a
 * pause from the control bar, or the others keep playing with no idea why.
 */

interface Options {
  /** What is playing — the title shown by the system. */
  title: string
  /** Second line, the "artist" slot: episode label, year and genres. */
  caption?: string
  /** Cover image. An SVG is redrawn as a PNG first; see below. */
  artwork?: string
  playing: boolean
  position: number
  duration: number
  onPlay: () => void
  onPause: () => void
  onSeekBy: (delta: number) => void
  onSeekTo: (seconds: number) => void
  /** Left out when nothing follows, which hides the system's next button. */
  onNext?: () => void
}

const DEFAULT_SEEK = 10

/**
 * The generated posters are SVG data URLs, which the platforms behind this
 * interface do not all decode. Redrawing one costs a canvas and happens once
 * per title; anything that goes wrong simply leaves the cover out rather than
 * the whole metadata.
 *
 * JPEG, not PNG: these compositions are smooth gradients under a grain
 * overlay, which PNG encodes at roughly fifteen times the size for no visible
 * gain. They are opaque by construction, so nothing is lost without an alpha
 * channel.
 */
function rasterize(url: string, width = 512): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const ratio = img.naturalWidth > 0 ? img.naturalHeight / img.naturalWidth : 1
      const height = Math.round(width * ratio) || width
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      if (!ctx) { reject(new Error('no 2d context')); return }
      ctx.drawImage(img, 0, 0, width, height)
      try {
        resolve(canvas.toDataURL('image/jpeg', 0.82))
      } catch (error) {
        reject(error instanceof Error ? error : new Error('tainted canvas'))
      }
    }
    img.onerror = () => reject(new Error('artwork did not load'))
    img.src = url
  })
}

export function useMediaSession({
  title, caption, artwork, playing, position, duration,
  onPlay, onPause, onSeekBy, onSeekTo, onNext,
}: Options) {
  /* ---- what is playing ---- */
  useEffect(() => {
    if (!('mediaSession' in navigator)) return
    let cancelled = false

    const apply = (cover?: { src: string; sizes?: string; type?: string }) => {
      if (cancelled) return
      navigator.mediaSession.metadata = new MediaMetadata({
        title,
        artist: caption ?? '',
        artwork: cover ? [cover] : [],
      })
    }

    if (!artwork) {
      apply()
    } else if (artwork.startsWith('data:image/svg')) {
      apply()
      void rasterize(artwork)
        .then((jpeg) => apply({ src: jpeg, sizes: '512x768', type: 'image/jpeg' }))
        .catch(() => {})
    } else {
      apply({ src: artwork })
    }

    return () => { cancelled = true }
  }, [title, caption, artwork])

  /* ---- what the system may ask for ---- */
  useEffect(() => {
    if (!('mediaSession' in navigator)) return

    const handlers: [MediaSessionAction, MediaSessionActionHandler | null][] = [
      ['play', () => onPlay()],
      ['pause', () => onPause()],
      ['seekbackward', (d) => onSeekBy(-(d.seekOffset ?? DEFAULT_SEEK))],
      ['seekforward', (d) => onSeekBy(d.seekOffset ?? DEFAULT_SEEK)],
      ['seekto', (d) => { if (typeof d.seekTime === 'number') onSeekTo(d.seekTime) }],
      ['nexttrack', onNext ? () => onNext() : null],
    ]

    for (const [action, handler] of handlers) {
      /* An action this browser does not know throws rather than no-op. */
      try { navigator.mediaSession.setActionHandler(action, handler) } catch { /* ignored */ }
    }

    return () => {
      for (const [action] of handlers) {
        try { navigator.mediaSession.setActionHandler(action, null) } catch { /* ignored */ }
      }
    }
  }, [onPlay, onPause, onSeekBy, onSeekTo, onNext])

  /* ---- playing or paused, and where ---- */
  useEffect(() => {
    if (!('mediaSession' in navigator)) return
    navigator.mediaSession.playbackState = playing ? 'playing' : 'paused'
  }, [playing])

  useEffect(() => {
    if (!('mediaSession' in navigator) || typeof navigator.mediaSession.setPositionState !== 'function') return
    if (!Number.isFinite(duration) || duration <= 0) return
    try {
      navigator.mediaSession.setPositionState({
        duration,
        position: Math.max(0, Math.min(position, duration)),
        playbackRate: 1,
      })
    } catch { /* A position the browser refuses is not worth an error. */ }
  }, [position, duration])

  /* ---- leave nothing behind on the lock screen ---- */
  useEffect(() => () => {
    if (!('mediaSession' in navigator)) return
    navigator.mediaSession.metadata = null
    navigator.mediaSession.playbackState = 'none'
  }, [])
}
