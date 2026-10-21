import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useReducedMotion } from 'motion/react'
import { Icon } from '@/components/Icon'
import { installeLucarne, useInstallation } from '@/lib/install'
import { deviceGuide, GUIDE_EVENT, readGuidePreferences, rememberGuide, shouldShowGuide, type DeviceGuide } from '@/lib/install-guide'
import './install-guide.css'

const DEVICES: { id: DeviceGuide; label: string }[] = [
  { id: 'desktop', label: 'Ordinateur' }, { id: 'android', label: 'Android' }, { id: 'ios', label: 'iPhone / iPad' },
]
const STEPS: Record<DeviceGuide, { title: string; text: string }[]> = {
  desktop: [
    { title: 'Ouvrez Lucarne dans Chrome', text: 'Cliquez sur l’icône d’installation à droite de la barre d’adresse, si elle apparaît.' },
    { title: 'Confirmez l’installation', text: 'Dans la fenêtre proposée par Chrome, choisissez Installer.' },
    { title: 'Votre Lucarne, à portée de clic', text: 'Retrouvez son icône parmi vos applications et ouvrez-la dans sa propre fenêtre.' },
  ],
  android: [
    { title: 'Ouvrez le menu de Chrome', text: 'Sur la page Lucarne, touchez les trois points en haut à droite.' },
    { title: 'Ajoutez Lucarne', text: 'Choisissez Installer l’application ou Ajouter à l’écran d’accueil, puis confirmez.' },
    { title: 'Retrouvez-la sur votre écran', text: 'Touchez l’icône Lucarne pour revenir directement à vos films et radios.' },
  ],
  ios: [
    { title: 'Ouvrez Lucarne dans Safari', text: 'Touchez le bouton Partager : le carré avec une flèche vers le haut.' },
    { title: 'Ajoutez-la à l’écran d’accueil', text: 'Choisissez Sur l’écran d’accueil, puis Ajouter. Activez Ouvrir comme app si proposé.' },
    { title: 'Et voilà votre application', text: 'L’icône Lucarne vous attend sur l’écran d’accueil de votre iPhone ou iPad.' },
  ],
}
function Download({ share = false }: { share?: boolean }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="21" height="21" aria-hidden="true"><path d={share ? 'M12 15V3m-4 4 4-4 4 4M7 10H4v11h16V10h-3' : 'M12 3v12m-4-4 4 4 4-4M4 16v5h16v-5'} /></svg>
}
function Demo({ device, step, paused }: { device: DeviceGuide; step: number; paused: boolean }) {
  return <div className={`install-demo ${device !== 'desktop' ? 'install-demo-mobile' : ''} ${paused ? 'install-demo-paused' : ''}`} aria-hidden="true">
    <span className="install-demo-label">Démonstration · {device === 'ios' ? 'Safari' : 'Chrome'}</span>
    <div className="install-browser"><div className="install-browser-bar"><span className="install-browser-dots">● ● ●</span>
      <span className="install-browser-address">Lucarne <span className={step === 0 ? 'install-highlight' : ''}>{device === 'android' ? '⋮' : <Download share={device === 'ios'} />}</span></span></div>
      <div className="install-browser-content"><div className="install-mini-brand"><img src="/icons/icon-192.png" alt="" /> LUCARNE</div><div className="install-mini-cards"><span /><span /><span /><span /></div>
        {step === 0 && <div className="install-demo-hint">{device === 'ios' ? 'Partager' : device === 'android' ? 'Ouvrir le menu' : 'Installer l’application'} <span>↗</span></div>}
        {step === 1 && <div className="install-confirm" key={`${device}-confirm`}><img src="/icons/icon-192.png" alt="" /><strong>Lucarne</strong><span>{device === 'ios' ? 'Sur l’écran d’accueil' : 'Installer l’application ?'}</span><div className="install-fake-button">{device === 'ios' ? 'Ajouter' : 'Installer'}</div></div>}
        {step === 2 && <div className="install-success" key={`${device}-success`}><div className="install-app-glow"><img src="/icons/icon-192.png" alt="" /><span>✓</span></div><strong>Lucarne</strong><span>Votre cinéma. Un geste suffit.</span></div>}
        {step < 2 && <svg key={`${device}-${step}`} className={`install-cursor install-cursor-${step}`} viewBox="0 0 28 36"><path d="M3 2v27l7-6 6 11 5-3-6-11 10-1Z" fill="#EDF0F6" stroke="#04070F" strokeWidth="2" /></svg>}
      </div></div>
  </div>
}
export function InstallGuide() {
  const { pathname } = useLocation()
  const installation = useInstallation()
  const reduced = useReducedMotion()
  const [open, setOpen] = useState(false)
  const [device, setDevice] = useState<DeviceGuide>(() => deviceGuide(navigator.userAgent, navigator.maxTouchPoints))
  const [step, setStep] = useState(0)
  const [paused, setPaused] = useState(false)
  const [never, setNever] = useState(false)
  const [details, setDetails] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const dialog = useRef<HTMLDialogElement>(null)
  const attempted = useRef(false)
  const visible = open && installation !== 'installed' && !pathname.startsWith('/lecture/')
  const canInstall = installation === 'ready' && device === deviceGuide(navigator.userAgent, navigator.maxTouchPoints)
  const close = useCallback(() => {
    try { rememberGuide(never ? 'never' : 'later', localStorage) } catch { /* stockage bloqué */ }
    setOpen(false)
  }, [never])
  useEffect(() => {
    const show = () => { attempted.current = true; setStep(0); setPaused(false); setMessage(''); setNever(false); setOpen(true) }
    window.addEventListener(GUIDE_EVENT, show)
    return () => window.removeEventListener(GUIDE_EVENT, show)
  }, [])
  useEffect(() => {
    if (pathname !== '/' || installation === 'installed' || attempted.current) return
    let preferences = {}
    try { preferences = readGuidePreferences(localStorage) } catch { /* stockage bloqué */ }
    if (!shouldShowGuide(preferences)) return
    const timer = window.setTimeout(() => {
      if (document.visibilityState !== 'visible' || document.querySelector('dialog[open], [aria-modal="true"]')) return
      attempted.current = true
      setOpen(true)
    }, 4000)
    return () => window.clearTimeout(timer)
  }, [pathname, installation])
  useEffect(() => {
    const element = dialog.current
    if (!element) return
    if (visible && !element.open) element.showModal()
    if (!visible && element.open) element.close()
    if (!visible) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = previous; if (element.open) element.close() }
  }, [visible])
  useEffect(() => {
    if (!visible || paused || reduced) return
    const timer = window.setInterval(() => setStep((s) => (s + 1) % 3), 3500)
    return () => window.clearInterval(timer)
  }, [visible, paused, reduced, device])
  async function install() {
    if (!canInstall) { setDetails(true); setPaused(true); return }
    setBusy(true); setPaused(true)
    try {
      const result = await installeLucarne()
      if (result === 'accepted') {
        try { rememberGuide('installed', localStorage) } catch { /* stockage bloqué */ }
        setOpen(false)
      } else setMessage('Aucun souci : vous pourrez installer Lucarne plus tard depuis le menu.')
    } catch { setMessage('L’installation automatique n’est pas disponible. Suivez les étapes du guide.'); setDetails(true) }
    finally { setBusy(false) }
  }
  return <dialog ref={dialog} aria-labelledby="install-title" aria-describedby="install-intro" className="install-guide"
    onCancel={(e) => { e.preventDefault(); close() }}
    onClick={(e) => { if (e.target === e.currentTarget) { const r = e.currentTarget.getBoundingClientRect(); if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) close() } }}>
    {visible && <div className="install-guide-inner">
      <button type="button" onClick={close} aria-label="Fermer le tutoriel d’installation" className="install-guide-close"><Icon name="close" size={19} /></button>
      <p className="install-eyebrow">LUCARNE, À EMPORTER</p><h2 id="install-title">Votre cinéma.<br /><span>À un geste de vous.</span></h2>
      <p id="install-intro" className="install-intro">Retrouvez Lucarne sur votre écran d’accueil, comme une application.</p>
      <div className="install-devices" role="group" aria-label="Appareil du tutoriel">{DEVICES.map((d) => <button key={d.id} type="button" aria-pressed={device === d.id} onClick={() => { setDevice(d.id); setStep(0) }}>{d.label}</button>)}</div>
      <Demo device={device} step={step} paused={paused || Boolean(reduced)} />
      <div className="install-step-caption"><span className="install-step-number">0{step + 1}</span><div><h3>{STEPS[device][step].title}</h3><p>{STEPS[device][step].text}</p></div></div>
      <div className="install-playback"><div className="install-step-dots" role="group" aria-label="Étapes du tutoriel">{STEPS[device].map((s, i) => <button type="button" key={s.title} aria-label={`Étape ${i + 1} : ${s.title}`} aria-pressed={step === i} onClick={() => { setStep(i); setPaused(true) }}><span /></button>)}</div>
        {!reduced && <button type="button" onClick={() => setPaused((p) => !p)} className="install-pause"><Icon name={paused ? 'play' : 'pause'} size={12} />{paused ? 'Reprendre' : 'Pause'}</button>}</div>
      <button type="button" aria-expanded={details} aria-controls="install-details" onClick={() => setDetails((d) => !d)} className="install-details-toggle">{details ? 'Masquer les étapes détaillées' : 'Voir les étapes détaillées'}</button>
      {details && <div id="install-details" className="install-details"><ol>{STEPS[device].map((s) => <li key={s.title}>{s.text}</li>)}</ol>
        {device === 'desktop' && <p>Si l’icône n’apparaît pas dans Chrome : menu ⋮ → Caster, enregistrer et partager → Installer la page en tant qu’appli. Les intitulés peuvent varier selon la version.</p>}
        <p>Sur téléphone, ouvrez le site dans votre navigateur habituel. Les vidéos et la radio nécessitent Internet.</p></div>}
      {message && <p className="install-message" role="status">{message}</p>}
      <div className="install-actions"><button type="button" className="install-primary" onClick={() => { void install() }} disabled={busy}>{busy ? 'Installation…' : canInstall ? 'Installer maintenant' : 'Comment installer'}<Download /></button><button type="button" className="install-later" onClick={close}>Plus tard</button></div>
      <label className="install-never"><input type="checkbox" checked={never} onChange={(e) => setNever(e.target.checked)} />Ne plus afficher sur cet appareil</label>
      <p className="install-footnote">Le guide reste disponible dans le menu « Installer l’application ».</p>
    </div>}
  </dialog>
}
