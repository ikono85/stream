import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Icon } from '@/components/Icon'
import { useLibrary } from '@/hooks/libraryContext'
import { useRadio } from '@/hooks/radioContext'
import { pays, type Station } from '@/lib/radio'

export function RadioArtwork({ station, className = '' }: { station: Station; className?: string }) {
  const [failed, setFailed] = useState(false)
  const src = station.favicon.startsWith('https://') ? station.favicon : ''
  return (
    <div className={`grid shrink-0 place-items-center overflow-hidden rounded-xl border border-ink-600 bg-ink-800 text-lamp-400 ${className}`}>
      {src && !failed ? <img src={src} onError={() => setFailed(true)} alt="" loading="lazy" referrerPolicy="no-referrer" className="h-full w-full object-contain p-2" /> : <Icon name="radio" size={28} />}
    </div>
  )
}

export function RadioCard({ station }: { station: Station }) {
  const { compte } = useLibrary()
  const radio = useRadio()
  const active = radio.station?.id === station.id
  const saved = radio.favoris.includes(station.id)
  const playing = active && (radio.status === 'playing' || radio.status === 'loading')
  const details = [station.countryCode ? pays(station.countryCode) : station.country, station.languages].filter(Boolean).join(' · ')
  return (
    <article className={`flex flex-col rounded-2xl border p-5 transition-colors ${active ? 'border-lamp-500/60 bg-ink-800' : 'border-ink-700 bg-ink-900/60 hover:border-ink-500'}`}>
      <div className="flex items-start gap-4">
        <RadioArtwork key={station.favicon} station={station} className="h-16 w-16" />
        <div className="min-w-0 flex-1">
          <h2 className="font-wide text-base font-bold leading-snug text-paper line-clamp-2">{station.name}</h2>
          <p className="mt-2 text-xs leading-relaxed text-haze-400 line-clamp-2">{details || 'Radio en direct'}</p>
        </div>
      </div>
      <div className="mt-5 flex min-h-7 flex-wrap gap-1.5">
        {station.tags.slice(0, 3).map((tag) => <span key={tag} className="max-w-full truncate rounded-full bg-ink-700 px-2.5 py-1 text-xs text-haze-300">{tag}</span>)}
      </div>
      <div className="mt-auto flex items-center gap-3 pt-5">
        <button type="button" onClick={() => active ? radio.togglePlayback() : radio.play(station)}
          aria-label={playing ? `Mettre ${station.name} en pause` : `Écouter ${station.name}`}
          className="inline-flex min-h-11 items-center gap-2 rounded-full bg-lamp-500 px-5 text-sm font-semibold text-ink-950 hover:bg-lamp-400">
          <Icon name={playing ? 'pause' : 'play'} size={16} />
          {active && radio.status === 'loading' ? 'Connexion…' : playing ? 'Pause' : 'Écouter'}
        </button>
        <span className="min-w-0 flex-1 text-xs text-haze-400">{station.bitrate > 0 ? `${station.bitrate} kb/s` : station.codec || 'En direct'}</span>
        {compte ? (
          <button type="button" aria-pressed={saved} aria-label={saved ? `Retirer ${station.name} des favoris` : `Ajouter ${station.name} aux favoris`}
            disabled={!radio.favorisReady || radio.pending.includes(station.id) || (!saved && radio.favoris.length >= 100)}
            onClick={() => void radio.toggleFavori(station.id)}
            className={`grid h-11 w-11 shrink-0 place-items-center rounded-full border border-ink-600 disabled:opacity-40 ${saved ? 'text-lamp-400' : 'text-haze-400 hover:text-paper'}`}>
            <Icon name="heart" size={19} className={saved ? 'fill-current' : ''} />
          </button>
        ) : <Link to="/connexion" aria-label={`Se connecter pour garder ${station.name} en favori`} className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-ink-600 text-haze-400 hover:text-paper"><Icon name="heart" size={19} /></Link>}
      </div>
    </article>
  )
}
