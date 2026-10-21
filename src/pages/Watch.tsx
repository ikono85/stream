import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Embed, type PlayerHandle } from '@/player/Embed'
import { RoomPanel } from '@/components/RoomPanel'
import { Icon } from '@/components/Icon'
import { useLibrary } from '@/hooks/libraryContext'
import { useRemote } from '@/hooks/useRemote'
import {
  episodeIdDe, episodes as chargeEpisodes, fiche, lisEntryId, lisEpisodeId, urlLecteur,
} from '@/lib/heiwa'
import { suit } from '@/lib/suivi'
import { newRoomCode } from '@/sync/protocol'
import { useWatchTogether } from '@/sync/useWatchTogether'
import { SITE } from '@/config'
import { NotFound } from '@/pages/NotFound'

/**
 * LA LECTURE
 * ==========
 * Le lecteur appartient à HeiwaStream : il vit dans une iframe et se pilote
 * par postMessage — voir player/Embed. Cette page ne fait que l'entourer :
 * elle sait quel titre et quel épisode lui donner, enregistre la position
 * qu'il rapporte, et tient la séance partagée.
 *
 * La séance partagée fonctionne tant que le lecteur rapporte sa position.
 * Certaines sources jouent dans le cadre d'un hébergeur tiers et n'envoient
 * rien : Embed le détecte et l'annonce. On ne fait pas semblant.
 */
export function Watch() {
  const { id } = useParams<{ id: string }>()
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const { saveProgress, progressFor, profile, compte } = useLibrary()

  const lecteurRef = useRef<PlayerHandle>(null)
  const [panneauOuvert, setPanneauOuvert] = useState(true)
  /* Le pseudo du compte en priorité : dans une salle partagée, c'est sous ce
     nom que les autres vous verront. Sans compte, « Invité », et chacun peut
     le changer dans le panneau. */
  const [nomAffiche, setNomAffiche] = useState(compte?.nom ?? profile?.name ?? 'Invité')

  const cible = id ? lisEntryId(id) : null
  const episodeParam = params.get('episode')
  const salle = params.get('salle')

  const titre = useRemote(
    (signal) => (cible ? fiche(cible.type, cible.tmdb, signal) : Promise.reject(new Error('id'))),
    [cible?.type, cible?.tmdb],
  )

  const entry = titre.data
  const serie = entry?.kind === 'serie'

  /* La saison à charger : celle de l'épisode demandé, sinon la première que
     la fiche annonce. */
  const demande = episodeParam ? lisEpisodeId(episodeParam) : null
  const saisonVoulue = demande?.season ?? entry?.seasons?.[0]?.number ?? 1

  const saison = useRemote(
    (signal) => (cible && serie
      ? chargeEpisodes(cible.tmdb, saisonVoulue, signal).then((s) => s.find((x) => x.number === saisonVoulue)?.episodes ?? [])
      : Promise.resolve([])),
    [cible?.tmdb, serie, saisonVoulue],
  )

  /* Mémorisé : `?? []` rendrait un tableau neuf à chaque rendu, et les deux
     useMemo ci-dessous repartiraient pour rien. */
  const listeEpisodes = useMemo(() => saison.data ?? [], [saison.data])

  /* L'épisode courant : celui demandé, sinon le premier qui a des sources. */
  const episode = useMemo(() => {
    if (!serie || listeEpisodes.length === 0) return undefined
    if (demande) {
      const exact = listeEpisodes.find((e) => e.number === demande.number)
      if (exact) return exact
    }
    return listeEpisodes.find((e) => e.sources > 0) ?? listeEpisodes[0]
  }, [serie, listeEpisodes, demande])

  /**
   * Ce qui suit : l'épisode d'après dans la saison, sinon le premier de la
   * saison suivante quand la fiche en annonce une. On ne va pas chercher
   * cette saison pour le savoir — son nombre d'épisodes suffit.
   */
  const suivant = useMemo(() => {
    if (!entry || !serie || !episode) return undefined
    const index = listeEpisodes.findIndex((e) => e.number === episode.number)
    const apres = index >= 0 ? listeEpisodes[index + 1] : undefined
    if (apres) {
      return apres.sources > 0
        ? { id: apres.id, season: apres.season, number: apres.number, title: apres.title }
        : undefined
    }
    const saisons = entry.seasons ?? []
    const rang = saisons.findIndex((s) => s.number === episode.season)
    const prochaine = rang >= 0 ? saisons[rang + 1] : undefined
    if (!prochaine || prochaine.episodeCount < 1) return undefined
    return {
      id: episodeIdDe(entry.tmdb, prochaine.number, 1),
      season: prochaine.number,
      number: 1,
      title: `Saison ${prochaine.number}, épisode 1`,
    }
  }, [entry, serie, episode, listeEpisodes])

  const avance = progressFor(entry?.id ?? '', episode?.id)
  /* Dans une salle, ce sont les autres qui décident d'où l'on part. */
  const depart = salle ? 0 : avance?.seconds ?? 0

  useEffect(() => {
    const nom = compte?.nom ?? profile?.name
    if (nom) setNomAffiche(nom)
  }, [compte?.nom, profile?.name])

  const room = useWatchTogether({
    code: salle,
    name: nomAffiche,
    player: lecteurRef,
  })

  useEffect(() => {
    if (!entry) return
    const precedent = document.title
    document.title = `${entry.title} — ${SITE.name}`
    return () => { document.title = precedent }
  }, [entry])

  /* Le seul signal de visionnage dont on dispose. Le lecteur étant muet, on
     sait qu'une lecture a été lancée, jamais combien de temps elle a duré. */
  useEffect(() => {
    if (!entry) return
    suit('lecture', {
      id: entry.id,
      titre: entry.title,
      ...(episode ? { episode: `S${episode.season} E${episode.number}` } : {}),
    })

    /* Et on le note aussi pour le spectateur lui-même. Sans position — le
       lecteur n'en donne pas — mais savoir quel épisode a été lancé suffit à
       reprendre une série au bon endroit, ce qui est l'essentiel. Une durée à
       zéro dit « lancé, position inconnue », et l'interface s'y tient au lieu
       d'inventer une barre de progression. */
    saveProgress({
      entryId: entry.id,
      ...(episode ? { episodeId: episode.id } : {}),
      seconds: 0,
      duration: 0,
      updatedAt: Date.now(),
    })
  }, [entry, episode, saveProgress])

  const enregistre = useCallback((seconds: number, duration: number) => {
    if (!entry || duration <= 0) return
    saveProgress({
      entryId: entry.id,
      ...(episode ? { episodeId: episode.id } : {}),
      seconds,
      duration,
      updatedAt: Date.now(),
    })
  }, [entry, episode, saveProgress])

  const versEpisode = useCallback((episodeId: string) => {
    if (!entry) return
    const query = new URLSearchParams(params)
    query.set('episode', episodeId)
    navigate(`/lecture/${entry.id}?${query}`, { replace: true })
  }, [entry, navigate, params])

  /* Remis à chaque épisode : annuler une fois ne doit pas couper la saison. */
  const enchaine = useRef(true)
  useEffect(() => { enchaine.current = true }, [episode?.id])

  const [finDeVideo, setFinDeVideo] = useState(false)
  useEffect(() => { setFinDeVideo(false) }, [episode?.id, entry?.id])

  const surFin = useCallback(() => {
    if (!entry) return
    if (suivant && enchaine.current) { setFinDeVideo(true); return }
    if (!suivant) navigate(`/titre/${entry.id}`)
  }, [entry, suivant, navigate])

  const aSuivre = useMemo(() => {
    if (!suivant || !finDeVideo) return null
    return {
      title: suivant.title,
      caption: `Saison ${suivant.season}, épisode ${suivant.number}`,
      /* Dans une salle, partir seul laisserait les autres derrière. */
      skippable: !salle,
    }
  }, [suivant, finDeVideo, salle])

  const sors = useCallback(() => {
    if (entry) navigate(`/titre/${entry.id}`)
    else navigate('/')
  }, [entry, navigate])

  const ouvreSalle = useCallback(() => {
    const next = new URLSearchParams(params)
    next.set('salle', newRoomCode())
    setParams(next, { replace: true })
    setPanneauOuvert(true)
  }, [params, setParams])

  const quitteSalle = useCallback(() => {
    const next = new URLSearchParams(params)
    next.delete('salle')
    setParams(next, { replace: true })
  }, [params, setParams])

  if (!cible) return <NotFound />
  if (titre.error?.code === 'not_found') return <NotFound />

  /* Le titre n'a pas pu être chargé : rien à lire, et il faut le dire. */
  if (titre.error && !entry) {
    return (
      <main className="grid min-h-dvh place-items-center bg-ink-950 px-6">
        <div className="max-w-[48ch] text-center">
          <Icon name="warning" size={32} className="mx-auto text-lamp-500" />
          <h1 className="mt-5 font-wide text-2xl font-extrabold leading-tight text-paper">
            La lecture n'a pas pu démarrer
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-haze-400">{titre.error.explication}</p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <button
              type="button"
              onClick={titre.recharge}
              className="inline-flex h-11 items-center gap-2 rounded-full bg-lamp-500 px-6 font-semibold text-ink-950 transition-colors hover:bg-lamp-400"
            >
              <Icon name="replay" size={17} />
              Réessayer
            </button>
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

  /* Le temps que la fiche arrive — et, pour une série, la saison avec elle :
     l'adresse du lecteur dépend du numéro d'épisode. */
  if (!entry || (serie && saison.loading && !saison.data)) {
    return (
      <main className="grid min-h-dvh place-items-center bg-ink-950">
        <div className="flex items-center gap-3 text-sm text-haze-400">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-ink-600 border-t-lamp-500" />
          Préparation de la lecture
        </div>
      </main>
    )
  }

  const src = urlLecteur(
    entry.type,
    entry.tmdb,
    episode ? { season: episode.season, number: episode.number } : undefined,
  )

  const legende = serie && episode
    ? `Saison ${episode.season}, épisode ${episode.number} — ${episode.title}`
    : entry.genres?.length
      ? `${entry.year > 0 ? `${entry.year} · ` : ''}${entry.genres.join(', ')}`
      : entry.year > 0 ? String(entry.year) : undefined

  const boutonSalle = salle ? (
    <button
      type="button"
      onClick={() => setPanneauOuvert((v) => !v)}
      aria-expanded={panneauOuvert}
      className="inline-flex h-10 items-center gap-2 rounded-full bg-ink-950/70 px-4 text-sm text-paper backdrop-blur-sm transition-colors hover:bg-ink-800"
    >
      <Icon name="together" size={17} className={room.status === 'open' ? 'text-lamp-500' : 'text-haze-400'} />
      <span className="nums-tabular">{room.members.length}</span>
      <span className="hidden sm:inline">{panneauOuvert ? 'Masquer' : 'Séance'}</span>
    </button>
  ) : (
    <button
      type="button"
      onClick={ouvreSalle}
      className="inline-flex h-10 items-center gap-2 rounded-full bg-ink-950/70 px-4 text-sm text-paper backdrop-blur-sm transition-colors hover:bg-ink-800"
    >
      <Icon name="together" size={17} />
      <span className="hidden sm:inline">Regarder ensemble</span>
    </button>
  )

  const avertissement = room.hold
    ? `${room.hold} charge la vidéo — reprise dès que c'est prêt`
    : room.status === 'lost'
      ? 'Connexion à la séance perdue, nouvelle tentative…'
      : room.error

  return (
    <div className="flex h-dvh w-full bg-ink-950">
      <div className="relative min-w-0 flex-1">
        <Embed
          key={episode?.id ?? entry.id}
          handle={lecteurRef}
          src={src}
          title={entry.title}
          caption={legende}
          startAt={depart}
          onProgress={enregistre}
          onEnded={surFin}
          onExit={sors}
          upNext={aSuivre}
          onUpNextPlay={() => { if (suivant) versEpisode(suivant.id) }}
          onUpNextDismiss={() => { enchaine.current = false; setFinDeVideo(false) }}
          onLocalAction={room.reportLocalAction}
          /* On ne signale le mutisme du lecteur que s'il prive de quelque
             chose : une reprise attendue, ou une séance en cours. */
          attendDesEvenements={Boolean(salle) || depart > 0}
          headerExtra={boutonSalle}
          notice={avertissement}
        />
      </div>

      {salle && panneauOuvert && (
        <RoomPanel
          room={room}
          code={salle}
          name={nomAffiche}
          onRename={setNomAffiche}
          onClose={() => setPanneauOuvert(false)}
          onLeave={quitteSalle}
        />
      )}
    </div>
  )
}
