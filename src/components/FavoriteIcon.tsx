import { useEffect, useRef } from 'react'
import { Icon } from '@/components/Icon'

/** Anime uniquement un ajout confirmé par la sauvegarde de la bibliothèque. */
export function FavoriteIcon({ saved, size = 18 }: { saved: boolean; size?: number }) {
  const node = useRef<HTMLSpanElement>(null)
  const precedent = useRef(saved)
  useEffect(() => {
    let animation: Animation | undefined
    if (saved && !precedent.current && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      animation = node.current?.animate([
        { transform: 'scale(0.65) rotate(-35deg)', filter: 'drop-shadow(0 0 0px #ffbc55)' },
        { transform: 'scale(1.4) rotate(8deg)', filter: 'drop-shadow(0 0 9px #ffbc55)', offset: 0.55 },
        { transform: 'scale(1) rotate(0deg)', filter: 'drop-shadow(0 0 0px #ffbc55)' },
      ], { duration: 450, easing: 'ease-out' })
    }
    precedent.current = saved
    return () => animation?.cancel()
  }, [saved])
  return <span ref={node} className={`inline-flex ${saved ? 'text-lamp-500' : ''}`}><Icon name={saved ? 'check' : 'plus'} size={size} /></span>
}
