import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Icon } from '@/components/Icon'

interface Props {
  title: string
  /** Optional destination for the row header. */
  href?: string
  children: ReactNode
}

export function Row({ title, href, children }: Props) {
  const trackRef = useRef<HTMLDivElement>(null)
  const [atStart, setAtStart] = useState(true)
  const [atEnd, setAtEnd] = useState(true)

  const measure = useCallback(() => {
    const el = trackRef.current
    if (!el) return
    const max = el.scrollWidth - el.clientWidth
    setAtStart(el.scrollLeft <= 2)
    setAtEnd(el.scrollLeft >= max - 2)
  }, [])

  useEffect(() => {
    const el = trackRef.current
    if (!el) return
    measure()
    el.addEventListener('scroll', measure, { passive: true })
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => {
      el.removeEventListener('scroll', measure)
      ro.disconnect()
    }
  }, [measure])

  const page = (direction: 1 | -1) => {
    const el = trackRef.current
    if (!el) return
    el.scrollBy({ left: direction * el.clientWidth * 0.82, behavior: 'smooth' })
  }

  const scrollable = !(atStart && atEnd)

  return (
    <section className="group/row relative py-5">
      <div className="gutter mb-3 flex items-baseline justify-between gap-4">
        <h2 className="font-wide text-base font-bold text-paper lg:text-lg">
          {href ? (
            <Link to={href} className="transition-colors hover:text-lamp-500">{title}</Link>
          ) : title}
        </h2>
        {href && (
          <Link
            to={href}
            className="shrink-0 text-xs text-haze-400 transition-colors hover:text-paper"
          >
            Tout voir
          </Link>
        )}
      </div>

      <div className="relative">
        <div
          ref={trackRef}
          className="hide-scrollbar gutter flex snap-x gap-3 overflow-x-auto scroll-smooth pb-2 lg:gap-4"
        >
          {children}
        </div>

        {scrollable && (
          <>
            <button
              type="button"
              onClick={() => page(-1)}
              disabled={atStart}
              aria-label={`${title} : éléments précédents`}
              className="absolute left-1 top-1/2 hidden h-20 w-9 -translate-y-1/2 place-items-center rounded-lg bg-ink-950/75 text-paper backdrop-blur-sm transition-[opacity,background-color] hover:bg-ink-950/95 disabled:pointer-events-none disabled:opacity-0 lg:grid lg:opacity-0 lg:group-hover/row:opacity-100 lg:focus-visible:opacity-100"
            >
              <Icon name="chevronLeft" size={22} />
            </button>
            <button
              type="button"
              onClick={() => page(1)}
              disabled={atEnd}
              aria-label={`${title} : éléments suivants`}
              className="absolute right-1 top-1/2 hidden h-20 w-9 -translate-y-1/2 place-items-center rounded-lg bg-ink-950/75 text-paper backdrop-blur-sm transition-[opacity,background-color] hover:bg-ink-950/95 disabled:pointer-events-none disabled:opacity-0 lg:grid lg:opacity-0 lg:group-hover/row:opacity-100 lg:focus-visible:opacity-100"
            >
              <Icon name="chevronRight" size={22} />
            </button>
          </>
        )}
      </div>
    </section>
  )
}
