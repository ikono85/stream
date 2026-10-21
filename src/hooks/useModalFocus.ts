import { useEffect, useRef, type RefObject } from 'react'

/** Garde le clavier dans la fenêtre et rend le focus à son déclencheur. */
export function useModalFocus(
  open: boolean,
  dialog: RefObject<HTMLElement | null>,
  onClose: () => void,
  initial: RefObject<HTMLElement | null>,
) {
  const close = useRef(onClose)
  useEffect(() => { close.current = onClose }, [onClose])
  useEffect(() => {
    const root = dialog.current
    if (!open || !root) return
    const previous = document.activeElement
    const controls = () => [...root.querySelectorAll<HTMLElement>(
      'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),iframe,[tabindex]:not([tabindex="-1"])',
    )].filter((el) => el.getClientRects().length > 0 && !el.closest('[inert]'))
    const focusFirst = () => (initial.current ?? controls()[0] ?? root).focus()
    focusFirst()
    const keydown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close.current(); return }
      if (e.key !== 'Tab') return
      const items = controls()
      const first = items[0]
      const last = items.at(-1)
      if (!first) { e.preventDefault(); root.focus(); return }
      if (e.shiftKey && (document.activeElement === first || document.activeElement === root)) {
        e.preventDefault(); last?.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault(); first.focus()
      }
    }
    const focusin = (e: FocusEvent) => {
      if (e.target instanceof Node && !root.contains(e.target)) focusFirst()
    }
    document.addEventListener('keydown', keydown, true)
    document.addEventListener('focusin', focusin)
    return () => {
      document.removeEventListener('keydown', keydown, true)
      document.removeEventListener('focusin', focusin)
      if (previous instanceof HTMLElement && previous.isConnected) previous.focus()
    }
  }, [open, dialog, initial])
}
