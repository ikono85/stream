import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import { useLibrary } from '@/hooks/libraryContext'
import { RadioContext, type RadioStatus } from '@/hooks/radioContext'
import { demandeRadio, type Station } from '@/lib/radio'
import type Hls from 'hls.js'

function volumeInitial() {
  try {
    const saved = localStorage.getItem('lucarne.radio.volume')
    const volume = saved === null ? 0.7 : Number(saved)
    return Number.isFinite(volume) ? Math.max(0, Math.min(1, volume)) : 0.7
  } catch { return 0.7 }
}

export function RadioProvider({ children }: { children: ReactNode }) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const hlsRef = useRef<Hls | null>(null)
  const [station, setStation] = useState<Station | null>(null)
  const [status, setStatus] = useState<RadioStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const [volume, changeVolume] = useState(volumeInitial)
  const [muted, setMuted] = useState(false)
  const essai = useRef(0)
  const { compte, compteEnCours } = useLibrary()
  const { pathname } = useLocation()
  const [stock, setStock] = useState<{ owner: string; ids: string[] } | null>(null)
  const [favorisError, setFavorisError] = useState<string | null>(null)
  const [pending, setPending] = useState<string[]>([])
  const [revision, setRevision] = useState(0)
  const ownerRef = useRef(compte?.id)
  ownerRef.current = compte?.id
  const favoris = stock?.owner === compte?.id ? stock?.ids ?? [] : []
  const favorisReady = !compteEnCours && (!compte || stock?.owner === compte.id)

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    audio.volume = volume
    audio.muted = muted
    try { localStorage.setItem('lucarne.radio.volume', String(volume)) } catch { /* stockage facultatif */ }
  }, [volume, muted])

  const stop = useCallback(() => {
    essai.current += 1
    const audio = audioRef.current
    hlsRef.current?.destroy()
    hlsRef.current = null
    if (audio) { audio.pause(); audio.removeAttribute('src'); audio.load() }
    setStation(null)
    setStatus('idle')
    setError(null)
  }, [])

  const demarre = useCallback((s: Station, nouveau: boolean) => {
    const audio = audioRef.current
    if (!audio) return
    const numero = ++essai.current
    setStation(s)
    setError(null)
    if (nouveau) {
      audio.pause()
      hlsRef.current?.destroy()
      hlsRef.current = null
      audio.removeAttribute('src')
      audio.load()
    }
    if (window.location.protocol === 'https:' && !s.url.startsWith('https://')) {
      setStatus('error')
      setError('Cette station utilise un flux HTTP. Choisissez une station HTTPS.')
      return
    }
    setStatus('loading')
    const lance = () => { void audio.play().catch((e: DOMException) => {
      if (essai.current !== numero) return
      setStatus('error')
      setError(e.name === 'NotAllowedError' ? 'Appuyez sur Lecture pour autoriser le son.' : 'Ce flux est indisponible ou incompatible. Essayez une autre station.')
    }) }
    if (s.hls && !audio.canPlayType('application/vnd.apple.mpegurl')) {
      if (hlsRef.current && !audio.error) { hlsRef.current.startLoad(); lance() }
      else void import('hls.js').then(({ default: Hls }) => {
        if (essai.current !== numero) return
        if (!Hls.isSupported()) throw new Error('HLS indisponible')
        hlsRef.current?.destroy()
        const hls = new Hls({ maxBufferLength: 15, maxMaxBufferLength: 30 })
        hlsRef.current = hls
        hls.on(Hls.Events.MANIFEST_PARSED, () => { if (essai.current === numero) lance() })
        hls.on(Hls.Events.ERROR, (_event, data) => {
          if (!data.fatal || hlsRef.current !== hls) return
          hls.destroy()
          hlsRef.current = null
          audio.pause()
          setStatus('error')
          setError('Le flux de cette radio ne répond pas. Réessayez ou choisissez une autre station.')
        })
        hls.loadSource(s.url)
        hls.attachMedia(audio)
      }).catch(() => {
        if (essai.current === numero) { setStatus('error'); setError('Impossible de charger ce flux HLS. Essayez une autre station.') }
      })
    } else {
      if (nouveau || audio.error) { audio.src = s.url; audio.load() }
      lance()
    }
    if (nouveau) void demandeRadio(`radio/click/${s.id}`, undefined, 'POST').catch(() => {})
  }, [])

  const play = useCallback((s: Station) => demarre(s, true), [demarre])
  const togglePlayback = useCallback(() => {
    const audio = audioRef.current
    if (!audio || !station) return
    if (status === 'playing' || status === 'loading') {
      essai.current += 1
      audio.pause()
      hlsRef.current?.stopLoad()
      setStatus('paused')
    } else demarre(station, false)
  }, [station, status, demarre])

  useEffect(() => { if (pathname.startsWith('/lecture/')) stop() }, [pathname, stop])
  useEffect(() => () => {
    essai.current += 1
    hlsRef.current?.destroy()
  }, [])
  useEffect(() => {
    if (status !== 'loading') return
    const timer = window.setTimeout(() => {
      essai.current += 1
      audioRef.current?.pause()
      setStatus('error')
      setError('La station met trop de temps à répondre. Réessayez ou choisissez une autre radio.')
    }, 20000)
    return () => window.clearTimeout(timer)
  }, [status, station?.id])

  useEffect(() => {
    if (!('mediaSession' in navigator) || !station) return
    navigator.mediaSession.metadata = new MediaMetadata({ title: station.name, artist: 'Radio en direct', album: station.country })
    navigator.mediaSession.setActionHandler('play', () => demarre(station, false))
    navigator.mediaSession.setActionHandler('pause', () => { essai.current += 1; audioRef.current?.pause(); setStatus('paused') })
    navigator.mediaSession.setActionHandler('stop', stop)
    return () => {
      navigator.mediaSession.metadata = null
      for (const action of ['play', 'pause', 'stop'] as const) navigator.mediaSession.setActionHandler(action, null)
    }
  }, [station, demarre, stop])

  useEffect(() => {
    setPending([])
    setFavorisError(null)
    if (!compte || compteEnCours) { setStock(null); return }
    const controller = new AbortController()
    const owner = compte.id
    void demandeRadio<{ favorisRadio: string[] }>('bibliotheque/radios', controller.signal)
      .then((data) => { if (!controller.signal.aborted) setStock({ owner, ids: data.favorisRadio }) })
      .catch(() => { if (!controller.signal.aborted) setFavorisError('Impossible de charger vos favoris. Réessayez.') })
    return () => controller.abort()
  }, [compte, compteEnCours, revision])

  async function toggleFavori(id: string) {
    if (!compte || !favorisReady || pending.includes(id)) return
    const owner = compte.id
    const ajouter = !favoris.includes(id)
    setPending((ids) => [...ids, id])
    setFavorisError(null)
    try {
      await demandeRadio(`bibliotheque/radios/${id}`, undefined, ajouter ? 'PUT' : 'DELETE')
      if (ownerRef.current === owner) setStock((current) => current?.owner === owner ? {
        owner, ids: ajouter ? [id, ...current.ids.filter((x) => x !== id)].slice(0, 100) : current.ids.filter((x) => x !== id),
      } : current)
    } catch {
      if (ownerRef.current === owner) setFavorisError('Le favori n’a pas pu être enregistré. Réessayez.')
    } finally {
      if (ownerRef.current === owner) setPending((ids) => ids.filter((x) => x !== id))
    }
  }

  return (
    <RadioContext value={{ station, status, error, volume, muted, play, togglePlayback, stop,
      setVolume: (v) => changeVolume(Math.max(0, Math.min(1, v))), toggleMute: () => setMuted((v) => !v),
      favoris, favorisReady, favorisError, pending, toggleFavori, rechargeFavoris: () => setRevision((r) => r + 1) }}>
      {children}
      <audio ref={audioRef} preload="none"
        onPlaying={() => { setStatus('playing'); setError(null) }}
        onPause={() => { if (audioRef.current?.paused) setStatus((s) => s === 'playing' ? 'paused' : s) }}
        onWaiting={() => { if (!audioRef.current?.paused) setStatus('loading') }}
        onEnded={() => { setStatus('error'); setError('Le flux de la station a été interrompu. Réessayez.') }}
        onError={() => { setStatus('error'); setError('Ce flux est indisponible ou incompatible. Essayez une autre station.') }}
      />
    </RadioContext>
  )
}
