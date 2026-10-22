import { useSpoilers } from '@/hooks/useSpoilers'
export function SpoilerToggle() {
  const { sansSpoilers, bascule } = useSpoilers()
  return <button type="button" aria-pressed={sansSpoilers} onClick={bascule} title="Masquer les résumés, les titres d’épisodes et les bandes-annonces" className={`min-h-10 shrink-0 rounded-full border px-3 text-xs font-semibold transition-colors ${sansSpoilers ? 'border-lamp-500/60 bg-lamp-500/15 text-lamp-500' : 'border-ink-600 bg-ink-950/70 text-haze-300 hover:text-paper'}`}>
    Sans spoilers <span aria-hidden="true">{sansSpoilers ? '●' : '○'}</span><span className="sr-only">{sansSpoilers ? ' activé' : ' désactivé'}</span>
  </button>
}
