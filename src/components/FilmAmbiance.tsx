import { image, TAILLES } from '@/lib/images'
/** L'affiche floutée fournit ses vraies couleurs sans extraction ni requête serveur. */
export function FilmAmbiance({ poster }: { poster?: string | null }) {
  const src = image(poster, TAILLES.affiche)
  if (!src) return null
  return <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-20 -z-10 h-[48rem] overflow-hidden [mask-image:linear-gradient(to_bottom,transparent,black_15%,black_65%,transparent)]">
    <img src={src} alt="" decoding="async" onError={(e) => { e.currentTarget.style.visibility = 'hidden' }} className="h-full w-full scale-125 object-cover opacity-35 blur-[90px] saturate-150" />
  </div>
}
