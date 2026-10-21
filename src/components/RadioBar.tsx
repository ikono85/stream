import { Link, useLocation } from 'react-router-dom'
import { useRadio } from '@/hooks/radioContext'
import { RadioArtwork } from '@/components/RadioCard'
import { Icon } from '@/components/Icon'

export function RadioBar() {
  const radio = useRadio()
  const { pathname } = useLocation()
  if (!radio.station || pathname.startsWith('/lecture/')) return null
  const playing = radio.status === 'playing' || radio.status === 'loading'
  return (
    <section aria-label="Lecteur radio" className="fixed inset-x-0 bottom-0 z-50 border-t border-ink-500 bg-ink-950/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl">
      <div className="gutter mx-auto flex min-h-24 max-w-[90rem] items-center gap-3 sm:gap-5">
        <RadioArtwork key={radio.station.id} station={radio.station} className="hidden h-12 w-12 sm:grid" />
        <Link to="/radio" className="min-w-0 flex-1">
          <p className="truncate font-wide text-sm font-bold text-paper">{radio.station.name}</p>
          <p role="status" className={`mt-1 text-xs leading-snug line-clamp-2 ${radio.error ? 'text-lamp-400' : 'text-haze-400'}`}>
            {radio.error ?? (radio.status === 'loading' ? 'Connexion à la station…' : radio.status === 'playing' ? '● En direct' : 'En pause')}
          </p>
        </Link>
        <button type="button" onClick={radio.togglePlayback} aria-label={playing ? 'Mettre la radio en pause' : radio.error ? 'Réessayer la radio' : 'Reprendre la radio'}
          className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-lamp-500 text-ink-950 hover:bg-lamp-400">
          <Icon name={playing ? 'pause' : 'play'} size={20} />
        </button>
        <div className="hidden items-center gap-2 sm:flex">
          <button type="button" aria-label={radio.muted ? 'Rétablir le son de la radio' : 'Couper le son de la radio'} onClick={radio.toggleMute} className="grid h-11 w-11 place-items-center rounded-full text-haze-300 hover:bg-ink-800"><Icon name={radio.muted || radio.volume === 0 ? 'mute' : 'volume'} size={18} /></button>
          <input type="range" min="0" max="1" step="0.01" value={radio.volume} onChange={(e) => radio.setVolume(Number(e.target.value))} aria-label="Volume de la radio" className="h-11 w-24 accent-lamp-500" />
        </div>
        <button type="button" onClick={radio.stop} aria-label="Arrêter et fermer la radio" className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-haze-400 hover:bg-ink-800 hover:text-paper"><Icon name="close" size={18} /></button>
      </div>
    </section>
  )
}
