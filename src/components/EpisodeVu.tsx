import { useLibrary } from '@/hooks/libraryContext'
import { Icon } from '@/components/Icon'

export function EpisodeVu({ episodeId }: { episodeId: string }) {
  const { watched, ready, setEpisodeWatched } = useLibrary()
  const vu = watched.includes(episodeId)
  return <button type="button" disabled={!ready} aria-pressed={vu} onClick={() => setEpisodeWatched(episodeId, !vu)}
    aria-label={`${vu ? 'Marquer comme non vu' : 'Marquer comme vu'} : ${episodeId.split('-').at(-1)?.toUpperCase()}`}
    className={`inline-flex min-h-10 shrink-0 items-center gap-2 rounded-full border px-3 text-xs font-medium transition-colors disabled:opacity-50 ${vu ? 'border-lamp-500/50 bg-lamp-500/10 text-lamp-500' : 'border-ink-600 text-haze-300 hover:border-haze-400 hover:text-paper'}`}>
    <Icon name={vu ? 'check' : 'plus'} size={15} />{vu ? 'Vu' : 'Marquer comme vu'}
  </button>
}
