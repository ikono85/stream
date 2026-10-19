import {
  useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState,
  type ReactNode, type Ref,
} from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { Icon } from '@/components/Icon'
import { clock } from '@/lib/format'
import { useFullscreen } from '@/player/useFullscreen'
import { usePictureInPicture } from '@/player/usePictureInPicture'
import { useMediaSession } from '@/player/useMediaSession'
import type { Source, Subtitle } from '@/types'

type Status = 'loading' | 'ready' | 'error'

interface Props {
  sources: Source[]
  subtitles?: Subtitle[]
  title: string
  /** Second line under the title — episode label, year, whatever fits. */
  caption?: string
  /** Cover handed to the system's media controls. */
  artwork?: string
  /** Resume point in seconds. */
  startAt?: number
  onProgress: (seconds: number, duration: number) => void
  onEnded?: () => void
  onExit: () => void
  /** Imperative control, used by a shared room. */
  handle?: Ref<PlayerHandle>
  /** Fired only when THIS viewer plays, pauses or jumps. */
  onLocalAction?: (playing: boolean, time: number) => void
  /** Fired when this viewer's video starts and stops waiting on data. */
  onBuffering?: (value: boolean) => void
  /** Rendered beside the title — the shared-room button lives here. */
  headerExtra?: ReactNode
  /** Shown under the title when a room is holding playback. */
  notice?: string | null
  /** What follows this episode. Null for a film or a season finale. */
  upNext?: UpNext | null
  /** "Lire maintenant" — start the next episode without waiting for the end. */
  onUpNextPlay?: () => void
  /** "Annuler" — the viewer does not want the next episode to start. */
  onUpNextDismiss?: () => void
}

/** The card that counts down to the next episode. */
export interface UpNext {
  title: string
  /** Second line — "Saison 1, episode 3". */
  caption?: string
  /**
   * False inside a shared room: leaving early would strand the others on an
   * episode this viewer has already left.
   */
  skippable?: boolean
}

const SEEK_STEP = 10
/**
 * How long the card stays on screen. It counts the video's own remaining time
 * rather than a timer of its own, so pausing or scrubbing back dismisses it
 * honestly instead of racing the picture.
 */
const UP_NEXT_LEAD = 15

/**
 * What a shared room needs from the player: drive it, and read where it is.
 * Everything here moves the video WITHOUT reporting it back as a local
 * action, so applying a peer's command never bounces back to them.
 */
export interface PlayerHandle {
  play: () => void
  pause: () => void
  seek: (seconds: number) => void
  position: () => number
  isPlaying: () => boolean
}

export function Player({
  sources, subtitles = [], title, caption, artwork, startAt = 0, onProgress, onEnded, onExit,
  handle, onLocalAction, onBuffering, headerExtra, notice,
  upNext, onUpNextPlay, onUpNextDismiss,
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const shellRef = useRef<HTMLDivElement>(null)
  const hideTimer = useRef<number | null>(null)
  const seekedToStart = useRef(false)
  const reduced = useReducedMotion()

  const [sourceIndex, setSourceIndex] = useState(0)
  const [status, setStatus] = useState<Status>('loading')
  const [errorMessage, setErrorMessage] = useState('')
  const [playing, setPlaying] = useState(false)
  const [waiting, setWaiting] = useState(false)
  const [time, setTime] = useState(startAt)
  const [duration, setDuration] = useState(0)
  const [buffered, setBuffered] = useState(0)
  const [volume, setVolume] = useState(1)
  const [muted, setMuted] = useState(false)
  const [scrubbing, setScrubbing] = useState(false)
  const [controlsVisible, setControlsVisible] = useState(true)
  const [menu, setMenu] = useState<'quality' | 'subtitles' | null>(null)
  const [track, setTrack] = useState(-1)
  const [upNextDismissed, setUpNextDismissed] = useState(false)

  const { active: isFullscreen, toggle: toggleFullscreen } = useFullscreen(shellRef)
  const pip = usePictureInPicture(videoRef)

  /**
   * Keep only what this browser will actually decode, then one entry per
   * quality. A library holds mixed formats; asking the browser first beats
   * handing it a file it will refuse.
   */
  const playable = useMemo(() => {
    const probe = document.createElement('video')
    const seen = new Set<string>()
    return sources
      .filter((s) => {
        const isHls = s.src.includes('.m3u8') || s.type.includes('mpegurl')
        return isHls || probe.canPlayType(s.type) !== ''
      })
      .filter((s) => {
        const key = s.quality ?? s.src
        if (seen.has(key)) return false
        seen.add(key)
        return true
      })
  }, [sources])

  const source = playable[sourceIndex]

  /* ---- attach the source, including HLS when the browser needs help ---- */
  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    if (!source) {
      setStatus('error')
      setErrorMessage(
        "Aucune des sources de ce titre n'est dans un format que ce navigateur sait lire. Essayez un autre navigateur, ou convertissez le fichier en H.264/MP4 ou VP9/WebM.",
      )
      return
    }

    let destroyed = false
    let hls: { destroy: () => void } | null = null
    setStatus('loading')

    const isHls =
      source.src.includes('.m3u8') || source.type.includes('mpegurl') || source.type.includes('x-mpegURL')

    if (!isHls || video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = source.src
    } else {
      void (async () => {
        try {
          const { default: Hls } = await import('hls.js')
          if (destroyed) return
          if (!Hls.isSupported()) {
            setStatus('error')
            setErrorMessage("Ce navigateur ne sait pas lire un flux HLS.")
            return
          }
          const instance = new Hls({ enableWorker: true })
          instance.loadSource(source.src)
          instance.attachMedia(video)
          instance.on(Hls.Events.ERROR, (_e, data) => {
            if (data.fatal) {
              setStatus('error')
              setErrorMessage("Le flux s'est interrompu et n'a pas pu reprendre.")
            }
          })
          hls = instance
        } catch {
          if (!destroyed) {
            setStatus('error')
            setErrorMessage("Le lecteur HLS n'a pas pu être chargé.")
          }
        }
      })()
    }

    return () => {
      destroyed = true
      hls?.destroy()
    }
  }, [source])

  /* ---- media element events ---- */
  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    const onLoaded = () => {
      setDuration(video.duration || 0)
      setStatus('ready')
      if (!seekedToStart.current && startAt > 1 && startAt < (video.duration || 0) - 5) {
        video.currentTime = startAt
      }
      seekedToStart.current = true
    }
    const onTime = () => { if (!scrubbing) setTime(video.currentTime) }
    const onBuffered = () => {
      const last = video.buffered.length - 1
      if (last >= 0) setBuffered(video.buffered.end(last))
    }
    const onPlay = () => setPlaying(true)
    const onPause = () => { setPlaying(false); setWaiting(false) }
    const onWaiting = () => { setWaiting(true); onBuffering?.(true) }
    const onPlaying = () => {
      setWaiting(false)
      setStatus('ready')
      onBuffering?.(false)
    }
    const onCanPlay = () => onBuffering?.(false)
    const onEnd = () => onEnded?.()
    const onErr = () => {
      setStatus('error')
      setErrorMessage(
        navigator.onLine
          ? "Cette source n'a pas pu être lue. Le fichier est peut-être déplacé ou dans un format que ce navigateur refuse."
          : 'Connexion perdue. La lecture reprendra une fois le réseau revenu.',
      )
    }

    video.addEventListener('loadedmetadata', onLoaded)
    video.addEventListener('timeupdate', onTime)
    video.addEventListener('progress', onBuffered)
    video.addEventListener('play', onPlay)
    video.addEventListener('pause', onPause)
    video.addEventListener('waiting', onWaiting)
    video.addEventListener('playing', onPlaying)
    video.addEventListener('canplay', onCanPlay)
    video.addEventListener('ended', onEnd)
    video.addEventListener('error', onErr)

    return () => {
      video.removeEventListener('loadedmetadata', onLoaded)
      video.removeEventListener('timeupdate', onTime)
      video.removeEventListener('progress', onBuffered)
      video.removeEventListener('play', onPlay)
      video.removeEventListener('pause', onPause)
      video.removeEventListener('waiting', onWaiting)
      video.removeEventListener('playing', onPlaying)
      video.removeEventListener('canplay', onCanPlay)
      video.removeEventListener('ended', onEnd)
      video.removeEventListener('error', onErr)
    }
  }, [scrubbing, startAt, onEnded, onBuffering])

  /**
   * Imperative control for a shared room. These move the video directly and
   * never pass through the local-action path, so applying what a peer did is
   * not reported back to them.
   */
  useImperativeHandle(handle, () => ({
    play: () => { void videoRef.current?.play().catch(() => {}) },
    pause: () => videoRef.current?.pause(),
    seek: (seconds: number) => {
      const video = videoRef.current
      if (!video || !Number.isFinite(video.duration)) return
      const next = Math.max(0, Math.min(seconds, video.duration))
      video.currentTime = next
      setTime(next)
    },
    position: () => videoRef.current?.currentTime ?? 0,
    isPlaying: () => Boolean(videoRef.current && !videoRef.current.paused),
  }), [])

  /* ---- report progress every few seconds, and on the way out ---- */
  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    const id = window.setInterval(() => {
      if (!video.paused && video.duration > 0) onProgress(video.currentTime, video.duration)
    }, 5000)
    return () => {
      window.clearInterval(id)
      if (video.duration > 0 && video.currentTime > 1) onProgress(video.currentTime, video.duration)
    }
  }, [onProgress])

  /**
   * Lift the cues clear of the control bar while it is on screen. Native cues
   * sit on the bottom line and would otherwise be covered by it.
   */
  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    const place = () => {
      const showing = Array.from(video.textTracks).find((t) => t.mode === 'showing')
      if (!showing?.cues) return
      const line = controlsVisible ? -4 : -2
      Array.from(showing.cues).forEach((cue) => {
        if ('line' in cue) (cue as VTTCue).line = line
      })
    }

    place()
    const tracks = Array.from(video.textTracks)
    tracks.forEach((t) => t.addEventListener('cuechange', place))
    return () => tracks.forEach((t) => t.removeEventListener('cuechange', place))
  }, [controlsVisible, track])

  /* ---- controls auto-hide ---- */
  const wake = useCallback(() => {
    setControlsVisible(true)
    if (hideTimer.current) window.clearTimeout(hideTimer.current)
    hideTimer.current = window.setTimeout(() => {
      const video = videoRef.current
      if (video && !video.paused && !scrubbing) setControlsVisible(false)
    }, 3000)
  }, [scrubbing])

  useEffect(() => {
    wake()
    return () => { if (hideTimer.current) window.clearTimeout(hideTimer.current) }
  }, [wake, playing])

  useEffect(() => { if (menu) setControlsVisible(true) }, [menu])

  /* ---- controls ---- */
  const playNow = useCallback(() => {
    const video = videoRef.current
    if (!video || !video.paused) return
    void video.play().catch(() => {})
    onLocalAction?.(true, video.currentTime)
  }, [onLocalAction])

  const pauseNow = useCallback(() => {
    const video = videoRef.current
    if (!video || video.paused) return
    video.pause()
    onLocalAction?.(false, video.currentTime)
  }, [onLocalAction])

  /** The surface, the space bar and the button all come through here. */
  const togglePlay = useCallback(() => {
    const video = videoRef.current
    if (!video) return
    if (video.paused) playNow()
    else pauseNow()
  }, [playNow, pauseNow])

  const onSurfaceClick = useCallback(() => {
    if (menu) { setMenu(null); return }
    togglePlay()
  }, [menu, togglePlay])

  const seekTo = useCallback((seconds: number) => {
    const video = videoRef.current
    if (!video || !Number.isFinite(video.duration)) return
    const next = Math.max(0, Math.min(seconds, video.duration))
    video.currentTime = next
    setTime(next)
    onLocalAction?.(!video.paused, next)
  }, [onLocalAction])

  const seekBy = useCallback((delta: number) => {
    const video = videoRef.current
    if (video) seekTo(video.currentTime + delta)
  }, [seekTo])

  const applyVolume = useCallback((value: number) => {
    const video = videoRef.current
    if (!video) return
    const v = Math.max(0, Math.min(1, value))
    video.volume = v
    video.muted = v === 0
    setVolume(v)
    setMuted(v === 0)
  }, [])

  const toggleMute = useCallback(() => {
    const video = videoRef.current
    if (!video) return
    video.muted = !video.muted
    setMuted(video.muted)
  }, [])

  const chooseTrack = useCallback((index: number) => {
    const video = videoRef.current
    if (!video) return
    Array.from(video.textTracks).forEach((t, i) => {
      t.mode = i === index ? 'showing' : 'disabled'
    })
    setTrack(index)
    setMenu(null)
  }, [])

  const dismissUpNext = useCallback(() => {
    setUpNextDismissed(true)
    onUpNextDismiss?.()
  }, [onUpNextDismiss])

  /** Swap rendition without losing the viewer's place. */
  const chooseQuality = useCallback((index: number) => {
    const video = videoRef.current
    if (!video || index === sourceIndex) { setMenu(null); return }
    const at = video.currentTime
    const wasPlaying = !video.paused
    seekedToStart.current = true
    setSourceIndex(index)
    setMenu(null)
    const restore = () => {
      video.currentTime = at
      if (wasPlaying) void video.play().catch(() => {})
      video.removeEventListener('loadedmetadata', restore)
    }
    video.addEventListener('loadedmetadata', restore)
  }, [sourceIndex])

  /* ---- the system's own controls: lock screen, media keys, headset ---- */
  useMediaSession({
    title,
    caption,
    artwork,
    playing,
    position: time,
    duration,
    onPlay: playNow,
    onPause: pauseNow,
    onSeekBy: seekBy,
    onSeekTo: seekTo,
    onNext: upNext && upNext.skippable !== false ? onUpNextPlay : undefined,
  })

  /* ---- keyboard ---- */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = document.activeElement
      if (el instanceof HTMLInputElement || el instanceof HTMLSelectElement) return

      switch (e.key) {
        case ' ':
        case 'k': e.preventDefault(); togglePlay(); break
        case 'ArrowLeft': e.preventDefault(); seekBy(-SEEK_STEP); break
        case 'ArrowRight': e.preventDefault(); seekBy(SEEK_STEP); break
        case 'ArrowUp': e.preventDefault(); applyVolume(volume + 0.1); break
        case 'ArrowDown': e.preventDefault(); applyVolume(volume - 0.1); break
        case 'f': e.preventDefault(); toggleFullscreen(); break
        case 'm': e.preventDefault(); toggleMute(); break
        case 'p':
          e.preventDefault()
          if (pip.supported) pip.toggle()
          break
        case 'c':
          e.preventDefault()
          if (subtitles.length) chooseTrack(track === -1 ? 0 : -1)
          break
        case 'Escape':
          /* Close what is open before leaving: a menu, then fullscreen, then the player. */
          if (menu) { setMenu(null); break }
          if (!document.fullscreenElement) onExit()
          break
        default: return
      }
      wake()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [togglePlay, seekBy, applyVolume, toggleFullscreen, toggleMute, chooseTrack, onExit, wake, volume, track, subtitles.length, menu, pip])

  /* ---- scrub bar ---- */
  const barRef = useRef<HTMLDivElement>(null)

  const positionFromEvent = (clientX: number): number => {
    const bar = barRef.current
    if (!bar || !duration) return 0
    const rect = bar.getBoundingClientRect()
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
    return ratio * duration
  }

  const onBarPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    setScrubbing(true)
    setTime(positionFromEvent(e.clientX))
  }
  const onBarPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!scrubbing) return
    setTime(positionFromEvent(e.clientX))
  }
  const onBarPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!scrubbing) return
    e.currentTarget.releasePointerCapture(e.pointerId)
    setScrubbing(false)
    seekTo(positionFromEvent(e.clientX))
  }

  const pct = duration > 0 ? (time / duration) * 100 : 0
  const bufferedPct = duration > 0 ? (buffered / duration) * 100 : 0
  const chrome = controlsVisible || !playing || status === 'error'

  /* A one-minute test clip should not be covered for a quarter of its length. */
  const remaining = duration > 0 ? duration - time : 0
  const upNextLead = Math.min(UP_NEXT_LEAD, duration * 0.2)
  const upNextVisible = Boolean(
    upNext && !upNextDismissed && status === 'ready' && duration > 0 && !scrubbing &&
    remaining > 0 && remaining <= upNextLead,
  )

  return (
    <div
      ref={shellRef}
      className={`relative h-full w-full select-none bg-ink-950 ${chrome ? '' : 'cursor-none'}`}
      onPointerMove={wake}
      onPointerLeave={() => { if (playing) setControlsVisible(false) }}
    >
      <video
        ref={videoRef}
        className="h-full w-full bg-ink-950 object-contain"
        playsInline
        preload="metadata"
        onClick={onSurfaceClick}
        crossOrigin="anonymous"
      >
        {subtitles.map((s, i) => (
          <track
            key={s.src}
            kind="subtitles"
            src={s.src}
            srcLang={s.lang}
            label={s.label}
            default={i === track}
          />
        ))}
      </video>

      {/* Buffering */}
      {waiting && status !== 'error' && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <span className="h-10 w-10 animate-spin rounded-full border-2 border-paper/25 border-t-lamp-500" />
        </div>
      )}

      {/* Playback failure */}
      {status === 'error' && (
        <div className="absolute inset-0 grid place-items-center bg-ink-950/90 p-6">
          <div className="max-w-[44ch] text-center">
            <Icon name="warning" size={30} className="mx-auto text-lamp-500" />
            <h2 className="mt-4 font-wide text-lg font-bold text-paper">Lecture impossible</h2>
            <p className="mt-2 text-sm leading-relaxed text-haze-400">{errorMessage}</p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <button
                type="button"
                onClick={() => { setStatus('loading'); videoRef.current?.load() }}
                className="inline-flex h-10 items-center gap-2 rounded-full bg-lamp-500 px-5 text-sm font-semibold text-ink-950 transition-colors hover:bg-lamp-400"
              >
                <Icon name="replay" size={16} />
                Réessayer
              </button>
              <button
                type="button"
                onClick={onExit}
                className="inline-flex h-10 items-center rounded-full border border-ink-500 px-5 text-sm text-paper transition-colors hover:bg-ink-800"
              >
                Revenir à la fiche
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Chrome */}
      <AnimatePresence>
        {chrome && (
          <>
            <motion.div
              key="top"
              initial={{ opacity: 0, y: reduced ? 0 : -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: reduced ? 0 : -8 }}
              transition={{ duration: reduced ? 0 : 0.2 }}
              className="pointer-events-none absolute inset-x-0 top-0 bg-gradient-to-b from-ink-950/90 to-transparent p-4 pb-16 sm:p-6 sm:pb-20"
            >
              <div className="pointer-events-auto flex items-start gap-4">
                <button
                  type="button"
                  onClick={onExit}
                  aria-label="Quitter le lecteur"
                  className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-ink-950/60 text-paper backdrop-blur-sm transition-colors hover:bg-ink-800"
                >
                  <Icon name="arrowLeft" size={19} />
                </button>
                <div className="min-w-0 flex-1">
                  <h1 className="truncate font-wide text-base font-bold text-paper sm:text-lg">{title}</h1>
                  {caption && <p className="mt-0.5 truncate text-sm text-haze-300">{caption}</p>}
                  {notice && (
                    <p className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-ink-950/70 px-2.5 py-1 text-xs text-lamp-400 backdrop-blur-sm">
                      <span className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-lamp-500" />
                      {notice}
                    </p>
                  )}
                </div>
                {headerExtra && <div className="ml-auto shrink-0">{headerExtra}</div>}
              </div>
            </motion.div>

            <motion.div
              key="bottom"
              initial={{ opacity: 0, y: reduced ? 0 : 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: reduced ? 0 : 12 }}
              transition={{ duration: reduced ? 0 : 0.2 }}
              className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink-950/95 via-ink-950/70 to-transparent px-3 pb-4 pt-20 sm:px-6 sm:pb-6"
            >
              {/* Scrub bar */}
              <div
                ref={barRef}
                role="slider"
                tabIndex={0}
                aria-label="Progression"
                aria-valuemin={0}
                aria-valuemax={Math.round(duration)}
                aria-valuenow={Math.round(time)}
                aria-valuetext={`${clock(time)} sur ${clock(duration)}`}
                onPointerDown={onBarPointerDown}
                onPointerMove={onBarPointerMove}
                onPointerUp={onBarPointerUp}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowLeft') { e.preventDefault(); seekBy(-SEEK_STEP) }
                  if (e.key === 'ArrowRight') { e.preventDefault(); seekBy(SEEK_STEP) }
                }}
                className="group/bar relative -mx-1 cursor-pointer px-1 py-2.5 touch-none"
              >
                <div className="relative h-1 rounded-full bg-paper/20 transition-[height] duration-150 group-hover/bar:h-1.5">
                  <div className="absolute inset-y-0 left-0 rounded-full bg-paper/25" style={{ width: `${bufferedPct}%` }} />
                  <div className="absolute inset-y-0 left-0 rounded-full bg-lamp-500" style={{ width: `${pct}%` }} />
                  <span
                    className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-lamp-500 opacity-0 transition-opacity group-hover/bar:opacity-100"
                    style={{ left: `${pct}%`, opacity: scrubbing ? 1 : undefined }}
                  />
                </div>
              </div>

              <div className="flex items-center gap-1 sm:gap-2">
                <button type="button" onClick={togglePlay} aria-label={playing ? 'Pause' : 'Lecture'}
                  className="grid h-11 w-11 place-items-center rounded-full text-paper transition-colors hover:bg-paper/10">
                  <Icon name={playing ? 'pause' : 'play'} size={22} />
                </button>

                <button type="button" onClick={() => seekBy(-SEEK_STEP)} aria-label="Reculer de 10 secondes"
                  className="relative grid h-11 w-11 place-items-center rounded-full text-paper transition-colors hover:bg-paper/10">
                  <Icon name="back10" size={20} />
                  <span className="absolute text-[0.5rem] font-bold nums-tabular">10</span>
                </button>

                <button type="button" onClick={() => seekBy(SEEK_STEP)} aria-label="Avancer de 10 secondes"
                  className="relative grid h-11 w-11 place-items-center rounded-full text-paper transition-colors hover:bg-paper/10">
                  <Icon name="forward10" size={20} />
                  <span className="absolute text-[0.5rem] font-bold nums-tabular">10</span>
                </button>

                <div className="group/vol flex items-center">
                  <button type="button" onClick={toggleMute} aria-label={muted ? 'Rétablir le son' : 'Couper le son'}
                    className="grid h-11 w-11 place-items-center rounded-full text-paper transition-colors hover:bg-paper/10">
                    <Icon name={muted || volume === 0 ? 'mute' : 'volume'} size={20} />
                  </button>
                  <input
                    type="range" min={0} max={1} step={0.05}
                    value={muted ? 0 : volume}
                    onChange={(e) => applyVolume(Number(e.target.value))}
                    aria-label="Volume"
                    className="h-1 w-0 cursor-pointer accent-lamp-500 opacity-0 transition-[width,opacity] duration-200 group-hover/vol:w-20 group-hover/vol:opacity-100 focus-visible:w-20 focus-visible:opacity-100 sm:group-focus-within/vol:w-20 sm:group-focus-within/vol:opacity-100"
                  />
                </div>

                <p className="ml-2 text-xs text-haze-300 nums-tabular sm:text-sm">
                  {clock(time)} <span className="text-haze-400">/ {clock(duration)}</span>
                </p>

                <div className="ml-auto flex items-center gap-1 sm:gap-2">
                  {subtitles.length > 0 && (
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setMenu((m) => (m === 'subtitles' ? null : 'subtitles'))}
                        aria-label="Sous-titres"
                        aria-expanded={menu === 'subtitles'}
                        className={`grid h-11 w-11 place-items-center rounded-full transition-colors hover:bg-paper/10 ${
                          track >= 0 ? 'text-lamp-500' : 'text-paper'
                        }`}
                      >
                        <Icon name="subtitles" size={20} />
                      </button>
                      {menu === 'subtitles' && (
                        <Menu
                          label="Sous-titres"
                          options={[
                            { key: 'off', label: 'Désactivés', active: track === -1, onPick: () => chooseTrack(-1) },
                            ...subtitles.map((s, i) => ({
                              key: s.src, label: s.label, active: track === i, onPick: () => chooseTrack(i),
                            })),
                          ]}
                        />
                      )}
                    </div>
                  )}

                  {playable.length > 1 && (
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setMenu((m) => (m === 'quality' ? null : 'quality'))}
                        aria-label="Qualité"
                        aria-expanded={menu === 'quality'}
                        className="grid h-11 w-11 place-items-center rounded-full text-paper transition-colors hover:bg-paper/10"
                      >
                        <Icon name="quality" size={20} />
                      </button>
                      {menu === 'quality' && (
                        <Menu
                          label="Qualité"
                          options={playable.map((s, i) => ({
                            key: s.src,
                            label: s.quality ?? `Source ${i + 1}`,
                            active: i === sourceIndex,
                            onPick: () => chooseQuality(i),
                          }))}
                        />
                      )}
                    </div>
                  )}

                  {pip.supported && (
                    <button
                      type="button" onClick={pip.toggle}
                      aria-label={pip.active ? "Quitter l'image dans l'image" : "Image dans l'image"}
                      aria-pressed={pip.active}
                      className={`grid h-11 w-11 place-items-center rounded-full transition-colors hover:bg-paper/10 ${
                        pip.active ? 'text-lamp-500' : 'text-paper'
                      }`}
                    >
                      <Icon name="pip" size={20} />
                    </button>
                  )}

                  <button
                    type="button" onClick={toggleFullscreen}
                    aria-label={isFullscreen ? 'Quitter le plein écran' : 'Plein écran'}
                    className="grid h-11 w-11 place-items-center rounded-full text-paper transition-colors hover:bg-paper/10"
                  >
                    <Icon name={isFullscreen ? 'collapse' : 'expand'} size={20} />
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Up next */}
      <AnimatePresence>
        {upNextVisible && upNext && (
          <motion.div
            key="upnext"
            initial={{ opacity: 0, y: reduced ? 0 : 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: reduced ? 0 : 10 }}
            transition={{ duration: reduced ? 0 : 0.2 }}
            aria-label={`Episode suivant : ${upNext.title}`}
            className="absolute bottom-24 right-3 w-[min(20rem,calc(100%-1.5rem))] rounded-xl border border-ink-600 bg-ink-900/95 p-4 backdrop-blur-md glow-lift sm:bottom-28 sm:right-6"
          >
            <p className="text-xs text-haze-400">
              Épisode suivant dans{' '}
              <span className="font-semibold text-lamp-500 nums-tabular">{Math.ceil(remaining)}</span> s
            </p>
            <p className="mt-1.5 truncate font-wide text-sm font-bold text-paper">{upNext.title}</p>
            {upNext.caption && <p className="mt-0.5 truncate text-xs text-haze-300">{upNext.caption}</p>}
            <div className="mt-3 flex items-center gap-2">
              {upNext.skippable !== false && (
                <button
                  type="button"
                  onClick={onUpNextPlay}
                  className="inline-flex h-9 items-center gap-1.5 rounded-full bg-lamp-500 px-4 text-sm font-semibold text-ink-950 transition-colors hover:bg-lamp-400"
                >
                  <Icon name="next" size={15} />
                  Lire maintenant
                </button>
              )}
              <button
                type="button"
                onClick={dismissUpNext}
                className="inline-flex h-9 items-center rounded-full border border-ink-500 px-4 text-sm text-paper transition-colors hover:bg-ink-800"
              >
                Annuler
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function Menu({ label, options }: {
  label: string
  options: { key: string; label: string; active: boolean; onPick: () => void }[]
}) {
  return (
    <div
      role="menu"
      aria-label={label}
      className="absolute bottom-14 right-0 w-44 overflow-hidden rounded-xl border border-ink-600 bg-ink-900/95 p-1.5 backdrop-blur-md glow-lift"
    >
      <p className="px-2.5 py-1 text-xs text-haze-400">{label}</p>
      {options.map((o) => (
        <button
          key={o.key}
          type="button"
          role="menuitemradio"
          aria-checked={o.active}
          onClick={o.onPick}
          className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition-colors ${
            o.active ? 'bg-ink-700 text-paper' : 'text-haze-300 hover:bg-ink-800 hover:text-paper'
          }`}
        >
          <span className="flex-1 truncate">{o.label}</span>
          {o.active && <Icon name="check" size={14} className="text-lamp-500" />}
        </button>
      ))}
    </div>
  )
}
