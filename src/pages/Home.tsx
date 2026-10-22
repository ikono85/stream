import { useSpoilers } from '@/hooks/useSpoilers'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { PageTransition } from '@/components/layout/PageTransition'
import { Hero, HeroSkeleton } from '@/components/Hero'
import { Row } from '@/components/Row'
import { RangeeDistante, Panne } from '@/components/RangeeDistante'
import { ResumeCard, ResumeSkeleton } from '@/components/Card'
import { Icon } from '@/components/Icon'
import { useLibrary } from '@/hooks/libraryContext'
import { useRemote } from '@/hooks/useRemote'
import { calendrier, catalogue, classement, fichesDe, nouveautes } from '@/lib/heiwa'
import { episodeLabel, jour } from '@/lib/format'
import { GENRES } from '@/lib/genres'
import { PLATEFORMES } from '@/lib/plateformes'
import { reprisesParTitre } from '@/lib/progression'
import { SeriesSuivies } from '@/components/SeriesSuivies'

/** Titres par rangée. Au-delà, on fait défiler pour le plaisir de défiler. */
const RANGEE = 16

/** Rangées de genre d'emblée, puis par paquets, à l'approche du bas de page. */
const GENRES_DEBUT = 2
const GENRES_PAS = 2
const GENRES_MAX = 8

/**
 * Les genres mis en rayon, et dans quel ordre. Pas tous : dix-neuf rangées
 * de genre feraient dix-neuf appels pour une page qu'on parcourt à moitié.
 */
const EN_RAYON = ['Action', 'Comédie', 'Science-Fiction', 'Animation', 'Horreur', 'Drame', 'Thriller', 'Documentaire']

export function Home() {
  const { sansSpoilers } = useSpoilers()
  const { ready, progress } = useLibrary()

  /* Le classement de la semaine sert deux fois : le bandeau et la première
     rangée. Un seul appel, et les visuels des six titres mis en avant. */
  const top = useRemote((signal) => classement({ period: 'week', rich: RANGEE }, signal), [])

  /* Les titres commencés, redemandés par identifiant : « ma liste » et la
     reprise ne gardent que des identifiants, jamais les titres eux-mêmes. */
  const repris = useMemo(
    () => reprisesParTitre(progress).slice(0, 12),
    [progress],
  )
  const idsRepris = useMemo(() => [...new Set(repris.map((p) => p.entryId))], [repris])
  const clefRepris = idsRepris.join(',')
  const titresRepris = useRemote(
    (signal) => (idsRepris.length ? fichesDe(idsRepris, signal) : Promise.resolve([])),
    [clefRepris],
  )

  const semaine = useRemote((signal) => calendrier({}, signal), [])

  const [genresMontres, setGenresMontres] = useState(GENRES_DEBUT)
  const sentinelle = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = sentinelle.current
    const total = Math.min(EN_RAYON.length, GENRES_MAX)
    if (!el || genresMontres >= total) return
    const io = new IntersectionObserver(
      ([e]) => { if (e?.isIntersecting) setGenresMontres((n) => Math.min(n + GENRES_PAS, total)) },
      { rootMargin: '700px' },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [genresMontres])

  /* Une reprise n'a de sens que si son titre a pu être retrouvé. */
  const reprises = useMemo(() => {
    const parId = new Map((titresRepris.data ?? []).map((e) => [e.id, e]))
    return repris
      .map((p) => ({ p, entry: parId.get(p.entryId) }))
      .filter((x): x is { p: typeof repris[number]; entry: NonNullable<typeof x.entry> } => Boolean(x.entry))
  }, [repris, titresRepris.data])

  const prochains = (semaine.data ?? []).slice(0, 8)

  /* Rien du tout : la clé manque, ou HeiwaStream est injoignable. C'est la
     seule panne qui mérite de remplacer la page, parce qu'il n'y a pas de
     page sans catalogue. */
  if (top.error && !top.data) {
    return (
      <PageTransition>
        <div className="gutter mx-auto max-w-[90rem] pb-16 pt-32">
          <Panne message={top.error.explication} onRetry={top.recharge} />
        </div>
      </PageTransition>
    )
  }

  return (
    <PageTransition>
      {top.data && top.data.length > 0 ? <Hero entries={top.data} /> : <HeroSkeleton />}

      <div className="mx-auto max-w-[90rem] pb-8">
        <SeriesSuivies prochaines={semaine.data ?? []} />
        {!ready && (
          <Row title="Reprendre">
            {Array.from({ length: 4 }, (_, i) => <ResumeSkeleton key={i} />)}
          </Row>
        )}

        {ready && reprises.length > 0 && (
          <Row title="Reprendre">
            {reprises.map(({ p, entry }) => (
              <ResumeCard key={`${p.entryId}-${p.episodeId ?? ''}`} entry={entry} progress={p} />
            ))}
          </Row>
        )}

        <RangeeDistante
          title="Les plus regardés cette semaine"
          href="/catalogue"
          charge={(signal) => classement({ period: 'week', rich: RANGEE }, signal)}
          deps={[]}
          eager
        />

        <RangeeDistante
          title="Ajoutés récemment"
          href="/catalogue?tri=added"
          charge={(signal) => nouveautes({ rich: RANGEE }, signal)}
          deps={[]}
        />

        <RangeeDistante
          title="Films populaires"
          href="/catalogue?type=film"
          charge={(signal) => catalogue({ famille: 'movie', sort: 'popular', rich: RANGEE }, signal).then((p) => p.entries)}
          deps={[]}
        />

        <RangeeDistante
          title="Séries à découvrir"
          href="/catalogue?type=serie"
          charge={(signal) => catalogue({ famille: 'tv', sort: 'popular', rich: RANGEE }, signal).then((p) => p.entries)}
          deps={[]}
        />

        <RangeeDistante
          title="Animés"
          href="/catalogue?type=anime"
          charge={(signal) => catalogue({ famille: 'anime', sort: 'popular', rich: RANGEE }, signal).then((p) => p.entries)}
          deps={[]}
        />

        <RangeeDistante
          title="Les mieux notés"
          href="/catalogue?tri=rating"
          charge={(signal) => catalogue({ sort: 'rating', rich: RANGEE }, signal).then((p) => p.entries)}
          deps={[]}
        />

        {prochains.length > 0 && (
          <section className="gutter py-5">
            <div className="mb-3 flex items-baseline justify-between gap-4">
              <h2 className="font-wide text-base font-bold text-paper lg:text-lg">
                <Link to="/calendrier" className="transition-colors hover:text-lamp-500">
                  Attendus cette semaine
                </Link>
              </h2>
              <Link
                to="/calendrier"
                className="shrink-0 text-xs text-haze-400 transition-colors hover:text-paper"
              >
                Tout le calendrier
              </Link>
            </div>
            <ul className="divide-y divide-ink-700 border-y border-ink-700">
              {prochains.map((sortie) => (
                <li key={`${sortie.id}-${sortie.season}-${sortie.episode}`}>
                  <Link
                    to={`/titre/${sortie.id}`}
                    className="flex items-center gap-4 py-3 transition-colors hover:bg-ink-900/60"
                  >
                    <span className="w-24 shrink-0 text-xs text-haze-400 nums-tabular">
                      {jour(sortie.date)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-paper">{sortie.title}</span>
                      <span className="mt-0.5 block truncate text-xs text-haze-400">
                        {episodeLabel(sortie.season, sortie.episode)}
                        {!sansSpoilers && sortie.episodeTitle ? ` · ${sortie.episodeTitle}` : ''}
                      </span>
                    </span>
                    <Icon name="chevronRight" size={16} className="shrink-0 text-haze-400" />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Des liens, pas des requêtes : la bande ne coûte rien à l'affichage
            et mène au catalogue déjà filtré. */}
        <section className="gutter py-5">
          <h2 className="font-wide text-base font-bold text-paper lg:text-lg">Par plateforme</h2>
          <div className="hide-scrollbar mt-3 flex gap-2 overflow-x-auto pb-1">
            {PLATEFORMES.map((plateforme) => (
              <Link
                key={plateforme.id}
                to={`/catalogue?plateforme=${plateforme.id}`}
                className="inline-flex h-11 shrink-0 items-center rounded-full border border-ink-600 px-5 text-sm text-haze-300 transition-colors hover:border-lamp-500 hover:text-paper"
              >
                {plateforme.nom}
              </Link>
            ))}
          </div>
        </section>

        {EN_RAYON.slice(0, genresMontres).filter((g) => (GENRES as readonly string[]).includes(g)).map((genre) => (
          <RangeeDistante
            key={genre}
            title={genre}
            href={`/catalogue?genre=${encodeURIComponent(genre)}`}
            charge={(signal) => catalogue({ genre, sort: 'popular', rich: RANGEE }, signal).then((p) => p.entries)}
            deps={[genre]}
          />
        ))}

        {genresMontres < Math.min(EN_RAYON.length, GENRES_MAX) && (
          <div ref={sentinelle} className="h-24" aria-hidden="true" />
        )}
      </div>
    </PageTransition>
  )
}
