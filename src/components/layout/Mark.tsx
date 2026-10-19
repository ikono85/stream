/** The aperture: a ring with a lit disc sitting off-centre inside it. */
export function Mark({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="1.6" opacity="0.5" />
      <circle cx="13.6" cy="10.4" r="4.6" className="fill-lamp-500" />
    </svg>
  )
}
