import { useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'
import { PageTransition } from '@/components/layout/PageTransition'
import { PosterCard } from '@/components/Card'
import { Icon } from '@/components/Icon'
import { Art } from '@/components/Art'
import { personBySlug, type Credit, type PersonRecord } from '@/data/people'
import { bannerArt } from '@/lib/poster'
import { NotFound } from '@/pages/NotFound'
import type { Entry } from '@/types'

/** Two letters for a missing portrait — better than an empty disc. */
function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? '')
    .join('')
}

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`
}

/** What this person did, in the order the catalogue knows about it. */
function roleLine(person: PersonRecord): string {
  const parts: string[] = []
  if (person.directed.length > 0) {
    parts.push(`Réalisation de ${plural(person.directed.length, 'titre', 'titres')}`)
  }
  if (person.acted.length > 0) {
    parts.push(`Au générique de ${plural(person.acted.length, 'titre', 'titres')}`)
  }
  return parts.join(' · ')
}

/** Spread of years across every credit, e.g. "2008 – 2026". */
function span(entries: Entry[]): string | null {
  if (entries.length === 0) return null
  const years = entries.map((e) => e.year)
  const min = Math.min(...years)
  const max = Math.max(...years)
  return min === max ? String(min) : `${min} – ${max}`
}

const GRID = 'grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6 lg:gap-4 xl:grid-cols-7'

export function Person() {
  const { slug } = useParams<{ slug: string }>()
  const person = slug ? personBySlug(slug) : undefined

  /* The backdrop of their biggest title, as a faint header. */
  const feature = useMemo(() => {
    if (!person) return undefined
    const all = [...person.directed, ...person.acted.map((c) => c.entry)]
    const withArt = all.filter((e) => e.backdrop)
    return [...(withArt.length ? withArt : all)].sort((a, b) => b.popularity - a.popularity)[0]
  }, [person])

  const everything = useMemo(
    () => (person ? [...person.directed, ...person.acted.map((c) => c.entry)] : []),
    [person],
  )

  if (!person) return <NotFound />

  const years = span(everything)

  return (
    <PageTransition>
      <div className="relative isolate">
        {/* Someone else's artwork, blurred down to a texture: it places the
            person without pretending to be a portrait of them. */}
        <div className="absolute inset-x-0 top-0 -z-10 h-[42vh] min-h-72 overflow-hidden">
          <Art
            src={feature?.backdrop}
            fallback={bannerArt(feature?.id ?? person.slug)}
            alt=""
            className="h-full w-full scale-110 object-cover opacity-45 blur-xl"
          />
          <div className="absolute inset-0 bg-[linear-gradient(to_top,var(--color-ink-950)_0%,var(--color-ink-950)_42%,rgb(4_7_15_/_0.78)_100%)]" />
        </div>

        <div className="gutter mx-auto max-w-[90rem] pt-28 lg:pt-32">
          <Link
            to="/catalogue"
            className="inline-flex items-center gap-1.5 text-sm text-haze-300 transition-colors hover:text-paper"
          >
            <Icon name="arrowLeft" size={16} />
            Catalogue
          </Link>

          <header className="mt-7 flex flex-col items-start gap-5 sm:flex-row sm:items-end sm:gap-7">
            {person.photo ? (
              <img
                src={person.photo}
                alt={`Portrait de ${person.name}`}
                className="h-24 w-24 shrink-0 rounded-full bg-ink-800 object-cover glow-lift sm:h-32 sm:w-32"
              />
            ) : (
              <span
                aria-hidden="true"
                className="grid h-24 w-24 shrink-0 place-items-center rounded-full border border-ink-600 bg-ink-900 font-wide text-2xl font-bold text-haze-400 sm:h-32 sm:w-32"
              >
                {initials(person.name)}
              </span>
            )}

            <div className="min-w-0">
              <h1 className="font-wide text-[clamp(1.7rem,4.5vw,3rem)] font-extrabold leading-[1.02] tracking-[-0.015em] text-paper">
                {person.name}
              </h1>
              <p className="mt-2 text-sm text-haze-300">{roleLine(person)}</p>
              {years && <p className="mt-1 text-sm text-haze-400 nums-tabular">{years}</p>}
            </div>
          </header>
        </div>
      </div>

      <div className="gutter mx-auto max-w-[90rem] pb-16">
        {person.directed.length > 0 && (
          <section className="mt-12">
            <h2 className="font-wide text-xs font-bold uppercase tracking-[0.14em] text-haze-400">
              Réalisation
            </h2>
            <div className={`mt-5 ${GRID}`}>
              {person.directed.map((entry, i) => (
                <PosterCard key={entry.id} entry={entry} fluid eager={i < 7} />
              ))}
            </div>
          </section>
        )}

        {person.acted.length > 0 && (
          <section className="mt-12">
            <h2 className="font-wide text-xs font-bold uppercase tracking-[0.14em] text-haze-400">
              Au générique
            </h2>
            <ul className={`mt-5 ${GRID}`}>
              {person.acted.map((credit: Credit, i) => (
                <li key={credit.entry.id}>
                  <PosterCard entry={credit.entry} fluid eager={person.directed.length === 0 && i < 7} />
                  {credit.character && (
                    <p className="mt-1.5 line-clamp-2 text-[0.7rem] leading-snug text-haze-400">
                      {credit.character}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}

        <p className="mt-14 flex max-w-[62ch] items-start gap-2.5 text-xs leading-relaxed text-haze-400">
          <Icon name="info" size={15} className="mt-px shrink-0" />
          <span>
            Cette page ne liste que les titres présents dans ce catalogue — ce n'est pas une
            filmographie complète. Les personnes créditées sur les titres de démonstration sont
            inventées.
          </span>
        </p>
      </div>
    </PageTransition>
  )
}
