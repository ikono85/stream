import {
  useCallback, useEffect, useImperativeHandle, useRef, useState,
  type ReactNode, type Ref,
} from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { Icon } from '@/components/Icon'
import { ORIGINE_LECTEUR } from '@/lib/heiwa'

/**
 * LE LECTEUR
 * ==========
 * HeiwaStream ne donne jamais l'adresse d'un fichier : son API renvoie une
 * adresse de lecteur, et c'est ce lecteur qui joue. La lecture vit donc dans
 * une iframe, et tout ce que la page peut en faire passe par postMessage.
 *
 * Ce que cela change, par rapport à un <video> qu'on possède :
 *
 *   — Les commandes sont asynchrones et sans accusé de réception. On demande,
 *     on apprend le résultat par un événement. D'où `position` tenue ici à
 *     partir des `time` reçus, et non lue sur un élément.
 *   — Les boutons, le plein écran et l'image dans l'image appartiennent au
 *     lecteur distant. Notre barre ne garde que ce qui est à nous : sortir,
 *     le titre, la séance partagée.
 *   — Le plein écran est pris par l'iframe elle-même : nos surcouches
 *     disparaissent alors, et c'est normal.
 *   — Le lecteur déployé aujourd'hui **n'envoie aucun message** à la page qui
 *     l'encadre : ni `ready`, ni `time`, ni `ended`, et il ignore les
 *     commandes. Vérifié le 21 octobre 2026 depuis un domaine tiers, sur un
 *     film qui se lit parfaitement. La documentation décrit pourtant ce
 *     protocole — il n'est simplement pas encore en service.
 *
 *     Conséquence directe, et la raison d'une correction douloureuse : le
 *     voile de chargement ne doit JAMAIS attendre un message. Il se retire
 *     sur l'événement `load` de l'iframe, que le navigateur garantit. Attendre
 *     `ready` laissait un écran noir définitif par-dessus un lecteur qui
 *     fonctionnait.
 *
 *     L'écoute des messages reste en place : le jour où HeiwaStream livre le
 *     protocole, la reprise et la synchro repartent sans rien changer ici.
 */

/** Ce que le lecteur annonce. */
type MessageLecteur =
  | { heiwa: 'ready' }
  | { heiwa: 'play' }
  | { heiwa: 'pause' }
  | { heiwa: 'time'; position: number; duration: number }
  | { heiwa: 'ended' }
  | { heiwa: 'episode'; season: number; episode: number }
  | { heiwa: 'error'; message?: string }

/** Ce qu'on lui envoie. */
type CommandeLecteur =
  | { heiwa: 'play' }
  | { heiwa: 'pause' }
  | { heiwa: 'seek'; position: number }
  | { heiwa: 'volume'; level: number }
  | { heiwa: 'mute'; muted: boolean }
  | { heiwa: 'episode'; season: number; episode: number }

/**
 * La même interface que l'ancien lecteur maison exposait : la synchro des
 * salles s'en sert sans savoir ce qu'il y a derrière, et n'a donc pas changé.
 */
export interface PlayerHandle {
  play: () => void
  pause: () => void
  seek: (seconds: number) => void
  position: () => number
  isPlaying: () => boolean
}

export interface UpNext {
  title: string
  /** Deuxième ligne — « Saison 1, épisode 3 ». */
  caption?: string
  /** Faux dans une salle partagée : partir seul laisserait les autres. */
  skippable?: boolean
}

interface Props {
  /** L'adresse du lecteur, construite par lib/heiwa. */
  src: string
  title: string
  caption?: string
  /** Position de reprise, en secondes. Appliquée au premier `play`. */
  startAt?: number
  onProgress?: (seconds: number, duration: number) => void
  onEnded?: () => void
  onExit?: () => void
  handle?: Ref<PlayerHandle>
  /** Déclenché quand ce spectateur joue, met en pause ou saute lui-même. */
  onLocalAction?: (playing: boolean, time: number) => void
  /**
   * Vrai quand la page compte sur les messages du lecteur : une reprise à
   * appliquer, ou une séance partagée en cours. Le silence n'est signalé que
   * dans ce cas — avertir à chaque lecture d'une limite qui ne gêne personne
   * serait du bruit.
   */
  attendDesEvenements?: boolean
  /** Rendu à côté du titre — le bouton de séance partagée vit là. */
  headerExtra?: ReactNode
  /** Affiché sous le titre quand une salle retient la lecture. */
  notice?: string | null
  upNext?: UpNext | null
  onUpNextPlay?: () => void
  onUpNextDismiss?: () => void
}

/**
 * Fenêtre pendant laquelle un `play` ou un `pause` reçu est considéré comme
 * la conséquence de notre propre commande, et non comme un geste du
 * spectateur. Sans elle, une commande venue d'une salle repartirait vers la
 * salle, et les deux lecteurs se renverraient l'ordre indéfiniment.
 */
const ECHO_MS = 700

/** Au-delà, un lecteur qui n'a envoyé aucun `time` ne sait pas en envoyer. */
const SILENCE_MS = 8000

export function Embed({
  src, title, caption, startAt = 0,
  onProgress, onEnded, onExit, handle, onLocalAction, attendDesEvenements = false,
  headerExtra, notice, upNext, onUpNextPlay, onUpNextDismiss,
}: Props) {
  const cadreRef = useRef<HTMLIFrameElement>(null)
  const reduced = useReducedMotion()

  const [pret, setPret] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)
  const [barreVisible, setBarreVisible] = useState(true)
  const [aveugle, setAveugle] = useState(false)

  /* L'état de lecture n'est pas lisible sur l'iframe : il se déduit des
     événements, donc il est tenu ici. */
  const joue = useRef(false)
  const position = useRef(0)
  const duree = useRef(0)
  const echo = useRef(0)
  const reprise = useRef(false)
  const vuUnTime = useRef(false)
  const cacheBarre = useRef<number | null>(null)

  const envoie = useCallback((commande: CommandeLecteur) => {
    const fenetre = cadreRef.current?.contentWindow
    if (!fenetre) return
    fenetre.postMessage(commande, ORIGINE_LECTEUR)
  }, [])

  /** Une commande que nous émettons : l'écho qu'elle provoque est ignoré. */
  const commande = useCallback((c: CommandeLecteur) => {
    echo.current = Date.now()
    envoie(c)
  }, [envoie])

  useImperativeHandle(handle, () => ({
    play: () => { commande({ heiwa: 'play' }) },
    pause: () => { commande({ heiwa: 'pause' }) },
    seek: (seconds: number) => {
      position.current = seconds
      commande({ heiwa: 'seek', position: seconds })
    },
    position: () => position.current,
    isPlaying: () => joue.current,
  }), [commande])

  /* Une nouvelle adresse est un nouveau lecteur : tout l'état le suit. */
  useEffect(() => {
    setPret(false)
    setErreur(null)
    setAveugle(false)
    joue.current = false
    position.current = 0
    duree.current = 0
    reprise.current = false
    vuUnTime.current = false
  }, [src])

  /* Les messages du lecteur. L'origine est vérifiée : une page tierce ne
     doit pas pouvoir piloter la lecture ni fausser la position. */
  useEffect(() => {
    const ecoute = (event: MessageEvent) => {
      if (event.origin !== ORIGINE_LECTEUR) return
      const data = event.data as MessageLecteur | null
      if (!data || typeof data !== 'object' || typeof data.heiwa !== 'string') return

      const propre = Date.now() - echo.current < ECHO_MS

      switch (data.heiwa) {
        case 'ready':
          setPret(true)
          setErreur(null)
          break

        case 'play': {
          joue.current = true
          setPret(true)
          /* La reprise attend le premier play : demander la position avant
             que le lecteur ait chargé ne donne rien. */
          if (!reprise.current) {
            reprise.current = true
            if (startAt > 2) {
              position.current = startAt
              commande({ heiwa: 'seek', position: startAt })
            }
          }
          if (!propre) onLocalAction?.(true, position.current)
          break
        }

        case 'pause':
          joue.current = false
          if (!propre) onLocalAction?.(false, position.current)
          break

        case 'time': {
          vuUnTime.current = true
          if (typeof data.position === 'number') position.current = data.position
          if (typeof data.duration === 'number' && data.duration > 0) duree.current = data.duration
          if (duree.current > 0) onProgress?.(position.current, duree.current)
          break
        }

        case 'ended':
          joue.current = false
          onEnded?.()
          break

        case 'episode':
          /* Le lecteur a changé d'épisode de lui-même : la position repart. */
          position.current = 0
          reprise.current = true
          break

        case 'error':
          setErreur(data.message ?? "Le lecteur n'a pas pu démarrer cette source.")
          break
      }
    }

    window.addEventListener('message', ecoute)
    return () => window.removeEventListener('message', ecoute)
  }, [startAt, commande, onEnded, onLocalAction, onProgress])

  /**
   * Un lecteur qui joue sans jamais dire où il en est. La reprise et la
   * synchro ne sont alors pas tenables, et le dire vaut mieux que de laisser
   * deux personnes croire qu'elles regardent ensemble alors que non.
   */
  useEffect(() => {
    if (!pret || !attendDesEvenements) return
    const id = window.setTimeout(() => {
      if (!vuUnTime.current) setAveugle(true)
    }, SILENCE_MS)
    return () => window.clearTimeout(id)
  }, [pret, attendDesEvenements])

  /* La barre s'efface quand la souris se repose, comme celle du lecteur. */
  const reveille = useCallback(() => {
    setBarreVisible(true)
    if (cacheBarre.current) window.clearTimeout(cacheBarre.current)
    cacheBarre.current = window.setTimeout(() => setBarreVisible(false), 3200)
  }, [])

  useEffect(() => {
    reveille()
    return () => { if (cacheBarre.current) window.clearTimeout(cacheBarre.current) }
  }, [reveille])

  /* Échap sort du lecteur. Les autres raccourcis appartiennent à l'iframe :
     tant que le focus est dedans, le clavier ne nous parvient pas. */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !document.fullscreenElement) onExit?.()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onExit])

  const avertissement = notice
    ?? (erreur ? null : aveugle
      ? "Ce lecteur ne rapporte pas sa position : reprise et synchronisation indisponibles."
      : null)

  return (
    <div
      className="relative h-full w-full bg-black"
      onPointerMove={reveille}
      onPointerDown={reveille}
    >
      <iframe
        ref={cadreRef}
        key={src}
        src={src}
        title={`${title} — lecteur HeiwaStream`}
        allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
        allowFullScreen
        /* Le seul signal fiable : le navigateur le garantit, le lecteur non. */
        onLoad={() => setPret(true)}
        className="h-full w-full border-0"
      />

      {/* Le temps que le lecteur distant s'annonce, l'écran reste noir : un
          voile qui dit ce qu'on attend vaut mieux qu'un rectangle vide.
          Il s'efface en fondu plutôt que de disparaître d'un coup — le film
          naît du noir, comme dans une salle. */}
      <AnimatePresence>
        {!pret && !erreur && (
          <motion.div
            key="voile"
            initial={{ opacity: 1 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduced ? 0 : 0.55, ease: [0.22, 1, 0.36, 1] }}
            className="pointer-events-none absolute inset-0 grid place-items-center bg-ink-950"
          >
            <motion.div
              exit={{ opacity: 0 }}
              transition={{ duration: reduced ? 0 : 0.2 }}
              className="flex items-center gap-3 text-sm text-haze-400"
            >
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-ink-600 border-t-lamp-500" />
              Chargement du lecteur
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {erreur && (
        <div className="absolute inset-0 grid place-items-center bg-ink-950 px-6">
          <div className="max-w-[46ch] text-center">
            <Icon name="warning" size={30} className="mx-auto text-lamp-500" />
            <p className="mt-4 font-wide text-lg font-bold text-paper">Lecture impossible</p>
            <p className="mt-2 text-sm leading-relaxed text-haze-400">{erreur}</p>
            <button
              type="button"
              onClick={onExit}
              className="mt-6 inline-flex h-11 items-center rounded-full bg-lamp-500 px-6 font-semibold text-ink-950 transition-colors hover:bg-lamp-400"
            >
              Retour à la fiche
            </button>
          </div>
        </div>
      )}

      {/* Notre barre : sortir, le titre, la séance. Tout le reste est au
          lecteur, et le dédoubler serait pire que de s'en passer. */}
      <AnimatePresence>
        {barreVisible && (
          <motion.div
            initial={{ opacity: 0, y: reduced ? 0 : -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: reduced ? 0 : -8 }}
            transition={{ duration: reduced ? 0 : 0.2 }}
            className="pointer-events-none absolute inset-x-0 top-0 z-10 bg-gradient-to-b from-ink-950/90 via-ink-950/45 to-transparent p-3 sm:p-4"
          >
            <div className="pointer-events-auto flex items-start gap-3">
              <button
                type="button"
                onClick={onExit}
                aria-label="Quitter le lecteur"
                className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-ink-950/70 text-paper backdrop-blur-sm transition-colors hover:bg-ink-800"
              >
                <Icon name="arrowLeft" size={19} />
              </button>

              <div className="min-w-0 flex-1 pt-0.5">
                <p className="truncate font-wide text-sm font-bold text-paper sm:text-base">{title}</p>
                {caption && <p className="mt-0.5 truncate text-xs text-haze-300">{caption}</p>}
                {avertissement && (
                  <p className="mt-1 flex items-center gap-1.5 text-xs text-lamp-500">
                    <Icon name="info" size={13} className="shrink-0" />
                    <span className="truncate">{avertissement}</span>
                  </p>
                )}
              </div>

              {headerExtra}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* « À suivre », par-dessus l'iframe. Invisible si le spectateur a mis
          le lecteur en plein écran : c'est l'iframe qui occupe l'écran. */}
      <AnimatePresence>
        {upNext && (
          <motion.div
            initial={{ opacity: 0, y: reduced ? 0 : 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: reduced ? 0 : 10 }}
            transition={{ duration: reduced ? 0 : 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="absolute bottom-20 right-4 z-10 w-[min(22rem,calc(100%-2rem))] rounded-[var(--radius-panel)] border border-ink-600 bg-ink-950/95 p-4 backdrop-blur-md sm:bottom-24"
          >
            <p className="font-wide text-xs font-bold uppercase tracking-[0.12em] text-haze-400">
              À suivre
            </p>
            <p className="mt-2 font-wide font-semibold leading-tight text-paper">{upNext.title}</p>
            {upNext.caption && <p className="mt-0.5 text-xs text-haze-400">{upNext.caption}</p>}
            <div className="mt-4 flex items-center gap-2">
              {upNext.skippable !== false && (
                <button
                  type="button"
                  onClick={onUpNextPlay}
                  className="inline-flex h-10 items-center gap-2 rounded-full bg-lamp-500 px-5 text-sm font-semibold text-ink-950 transition-colors hover:bg-lamp-400"
                >
                  <Icon name="play" size={15} />
                  Lire maintenant
                </button>
              )}
              <button
                type="button"
                onClick={onUpNextDismiss}
                className="inline-flex h-10 items-center rounded-full px-4 text-sm text-haze-300 transition-colors hover:text-paper"
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
