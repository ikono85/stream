import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Player, type PlayerHandle } from '@/player/Player'
import { RoomPanel } from '@/components/RoomPanel'
import { Icon } from '@/components/Icon'
import { useLibrary } from '@/hooks/libraryContext'
import { byId, episodesOf, episodeById } from '@/data/catalog'
import { posterArt } from '@/lib/poster'
import { newRoomCode } from '@/sync/protocol'
import { useWatchTogether } from '@/sync/useWatchTogether'
import { SITE } from '@/config'
import { NotFound } from '@/pages/NotFound'
import type { Entry, Episode } from '@/types'

/** "Saison 1, episode 3" — the way the player header already says it. */
function episodeLabel(entry: Entry, ep: Episode): string {
  const season = entry.seasons?.find((s) => s.episodes.some((e) => e.id === ep.id))
  return `Saison ${season?.number ?? 1}, épisode ${ep.number}`
}

export function Watch() {
  const { id } = useParams<{ id: string }>()
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const { saveProgress, progressFor, profile } = useLibrary()

  const playerRef = useRef<PlayerHandle>(null)
  const [panelOpen, setPanelOpen] = useState(true)
  /* Two people on the default profile would both read "Maison" in the room. */
  const [displayName, setDisplayName] = useState(profile?.name ?? 'Invité')

  const entry = id ? byId(id) : undefined
  const episodeId = params.get('episode') ?? undefined
  const roomCode = params.get('salle')

  const episodes = useMemo(() => (entry ? episodesOf(entry) : []), [entry])
  const episode = useMemo(() => {
    if (!entry || entry.kind !== 'serie') return undefined
    return (episodeId ? episodeById(entry, episodeId) : undefined)
      ?? episodes.find((e) => e.sources.length > 0)
      ?? episodes[0]
  }, [entry, episodeId, episodes])

  /* Only an episode with a file counts as "next" — an empty one would dead-end. */
  const nextEpisode = useMemo(() => {
    if (!entry || !episode) return undefined
    const index = episodes.findIndex((e) => e.id === episode.id)
    if (index < 0) return undefined
    const candidate = episodes[index + 1]
    return candidate && candidate.sources.length > 0 ? candidate : undefined
  }, [entry, episode, episodes])

  const sources = entry?.kind === 'film' ? entry.sources ?? [] : episode?.sources ?? []
  const subtitles = entry?.kind === 'film' ? entry.subtitles : episode?.subtitles

  const resume = progressFor(entry?.id ?? '', episode?.id)
  /* In a shared room the others decide where we start, not our own history. */
  const startAt = roomCode ? 0 : resume?.seconds ?? 0

  useEffect(() => {
    if (profile?.name) setDisplayName(profile.name)
  }, [profile?.name])

  const room = useWatchTogether({
    code: roomCode,
    name: displayName,
    player: playerRef,
  })

  const caption = useMemo(() => {
    if (!entry) return undefined
    if (entry.kind === 'film') return `${entry.year} · ${entry.genres.join(', ')}`
    if (!episode) return undefined
    return `${episodeLabel(entry, episode)} — ${episode.title}`
  }, [entry, episode])

  useEffect(() => {
    if (!entry) return
    const previous = document.title
    document.title = `${entry.title} — ${SITE.name}`
    return () => { document.title = previous }
  }, [entry])

  const handleProgress = useCallback((seconds: number, duration: number) => {
    if (!entry || duration <= 0) return
    saveProgress({
      entryId: entry.id,
      ...(episode ? { episodeId: episode.id } : {}),
      seconds,
      duration,
      updatedAt: Date.now(),
    })
  }, [entry, episode, saveProgress])

  const goToEpisode = useCallback((target: Episode) => {
    if (!entry) return
    const query = new URLSearchParams(params)
    query.set('episode', target.id)
    navigate(`/lecture/${entry.id}?${query}`, { replace: true })
  }, [entry, navigate, params])

  /* Cleared on every episode: cancelling once should not mute the whole season. */
  const autoNext = useRef(true)
  useEffect(() => { autoNext.current = true }, [episode?.id])

  const handleEnded = useCallback(() => {
    if (!entry) return
    if (nextEpisode && autoNext.current) { goToEpisode(nextEpisode); return }
    /* Cancelled: stay on the last frame rather than yanking the viewer away.
       Nothing to follow: the detail page is the natural place to land. */
    if (!nextEpisode) navigate(`/titre/${entry.id}`)
  }, [entry, nextEpisode, goToEpisode, navigate])

  const upNext = useMemo(() => {
    if (!entry || !nextEpisode) return null
    return {
      title: nextEpisode.title,
      caption: episodeLabel(entry, nextEpisode),
      /* In a room, skipping ahead alone would strand the others. */
      skippable: !roomCode,
    }
  }, [entry, nextEpisode, roomCode])

  const playNext = useCallback(() => {
    if (nextEpisode) goToEpisode(nextEpisode)
  }, [nextEpisode, goToEpisode])

  const cancelNext = useCallback(() => { autoNext.current = false }, [])

  const exit = useCallback(() => {
    if (entry) navigate(`/titre/${entry.id}`)
    else navigate('/')
  }, [entry, navigate])

  const startRoom = useCallback(() => {
    const next = new URLSearchParams(params)
    next.set('salle', newRoomCode())
    setParams(next, { replace: true })
    setPanelOpen(true)
  }, [params, setParams])

  const leaveRoom = useCallback(() => {
    const next = new URLSearchParams(params)
    next.delete('salle')
    setParams(next, { replace: true })
  }, [params, setParams])

  if (!entry) return <NotFound />

  /* No source is not an error to dress up — say so and offer a way out. */
  if (sources.length === 0) {
    return (
      <main className="grid min-h-dvh place-items-center bg-ink-950 px-6">
        <div className="max-w-[48ch] text-center">
          <Icon name="warning" size={32} className="mx-auto text-lamp-500" />
          <h1 className="mt-5 font-wide text-2xl font-extrabold leading-tight text-paper">
            {entry.title} n'a pas de source vidéo
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-haze-400">
            {entry.demo
              ? "Ce titre appartient au catalogue de démonstration : il est inventé et aucun fichier ne lui est associé. Branchez votre bibliothèque pour qu'il devienne lisible."
              : "Aucun fichier n'est associé à ce titre pour le moment."}
          </p>
          <p className="mt-3 text-sm leading-relaxed text-haze-400">
            Pour vérifier que le lecteur fonctionne, ouvrez la{' '}
            <Link to="/titre/mire-lucarne" className="text-lamp-500 underline underline-offset-2">
              mire de test
            </Link>{' '}
            ou l'un des courts métrages sous licence Creative Commons.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link
              to={`/titre/${entry.id}`}
              className="inline-flex h-11 items-center rounded-full bg-lamp-500 px-6 font-semibold text-ink-950 transition-colors hover:bg-lamp-400"
            >
              Retour à la fiche
            </Link>
            <Link
              to="/"
              className="inline-flex h-11 items-center rounded-full border border-ink-500 px-6 text-paper transition-colors hover:bg-ink-800"
            >
              Accueil
            </Link>
          </div>
        </div>
      </main>
    )
  }

  const roomButton = roomCode ? (
    <button
      type="button"
      onClick={() => setPanelOpen((v) => !v)}
      aria-expanded={panelOpen}
      className="inline-flex h-10 items-center gap-2 rounded-full bg-ink-950/70 px-4 text-sm text-paper backdrop-blur-sm transition-colors hover:bg-ink-800"
    >
      <Icon name="together" size={17} className={room.status === 'open' ? 'text-lamp-500' : 'text-haze-400'} />
      <span className="nums-tabular">{room.members.length}</span>
      <span className="hidden sm:inline">{panelOpen ? 'Masquer' : 'Séance'}</span>
    </button>
  ) : (
    <button
      type="button"
      onClick={startRoom}
      className="inline-flex h-10 items-center gap-2 rounded-full bg-ink-950/70 px-4 text-sm text-paper backdrop-blur-sm transition-colors hover:bg-ink-800"
    >
      <Icon name="together" size={17} />
      <span className="hidden sm:inline">Regarder ensemble</span>
    </button>
  )

  const notice = room.hold
    ? `${room.hold} charge la vidéo — reprise dès que c'est prêt`
    : room.status === 'lost'
      ? 'Connexion à la séance perdue, nouvelle tentative…'
      : room.error

  return (
    <div className="flex h-dvh w-full bg-ink-950">
      <div className="relative min-w-0 flex-1">
        <Player
          key={episode?.id ?? entry.id}
          handle={playerRef}
          sources={sources}
          subtitles={subtitles}
          title={entry.title}
          caption={caption}
          artwork={entry.artwork ?? posterArt(entry.id)}
          startAt={startAt}
          onProgress={handleProgress}
          onEnded={handleEnded}
          onExit={exit}
          upNext={upNext}
          onUpNextPlay={playNext}
          onUpNextDismiss={cancelNext}
          onLocalAction={room.reportLocalAction}
          onBuffering={room.reportBuffering}
          headerExtra={roomButton}
          notice={notice}
        />
      </div>

      {roomCode && panelOpen && (
        <RoomPanel
          room={room}
          code={roomCode}
          name={displayName}
          onRename={setDisplayName}
          onClose={() => setPanelOpen(false)}
          onLeave={leaveRoom}
        />
      )}
    </div>
  )
}
