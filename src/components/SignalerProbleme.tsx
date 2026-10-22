import { useRef, useState } from 'react'
import { Icon } from '@/components/Icon'
import { useModalFocus } from '@/hooks/useModalFocus'

export function SignalerProbleme({ entryId, titre, episodeId }: { entryId: string; titre: string; episodeId?: string }) {
  const [ouvert, setOuvert] = useState(false)
  const [motif, setMotif] = useState('lecture')
  const [commentaire, setCommentaire] = useState('')
  const [etat, setEtat] = useState<'pret' | 'envoi' | 'envoye'>('pret')
  const [erreur, setErreur] = useState('')
  const dialog = useRef<HTMLDivElement>(null)
  const fermer = useRef<HTMLButtonElement>(null)
  const ferme = () => { if (etat !== 'envoi') setOuvert(false) }
  useModalFocus(ouvert, dialog, ferme, fermer)

  async function envoie(e: React.FormEvent) {
    e.preventDefault()
    if (etat === 'envoi') return
    setEtat('envoi'); setErreur('')
    try {
      const r = await fetch('/api/signalements', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entryId, titre, episodeId, motif, commentaire }) })
      const corps = await r.json()
      if (!r.ok) throw new Error(corps.message || 'Le signalement n’a pas pu être envoyé.')
      setEtat('envoye')
    } catch (e) { setErreur(e instanceof Error ? e.message : 'Le serveur ne répond pas.'); setEtat('pret') }
  }
  return <>
    <button type="button" onClick={() => { setEtat('pret'); setErreur(''); setOuvert(true) }} className="inline-flex min-h-10 items-center gap-2 rounded-full border border-ink-600 px-3 text-xs text-haze-300 hover:text-paper">
      <Icon name="warning" size={15} /> Signaler un problème
    </button>
    {ouvert && <div ref={dialog} role="dialog" aria-modal="true" aria-labelledby="signalement-titre" tabIndex={-1} className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-ink-950/95 p-4" onClick={ferme}>
      <div className="w-full max-w-md rounded-2xl border border-ink-600 bg-ink-900 p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between gap-3"><h2 id="signalement-titre" className="font-wide font-bold text-paper">Signaler un problème</h2><button ref={fermer} type="button" onClick={ferme} disabled={etat === 'envoi'} aria-label="Fermer le signalement" className="grid h-10 w-10 place-items-center text-paper"><Icon name="close" /></button></div>
        <p className="mt-2 text-sm text-haze-300">{titre}{episodeId ? ` · ${episodeId.split('-').at(-1)?.toUpperCase()}` : ''}</p>
        {etat === 'envoye' ? <div role="status"><p className="mt-5 text-paper">Merci, votre signalement a bien été enregistré.</p><button type="button" onClick={ferme} className="mt-5 min-h-11 rounded-full bg-lamp-500 px-5 font-semibold text-ink-950">Fermer</button></div>
          : <form onSubmit={(e) => { void envoie(e) }} className="mt-5 space-y-4">
            <label className="block text-sm text-paper">Quel est le problème ?<select value={motif} onChange={(e) => setMotif(e.target.value)} disabled={etat === 'envoi'} className="mt-2 min-h-11 w-full rounded-lg border border-ink-600 bg-ink-950 px-3 text-paper">
              <option value="lecture">La vidéo ne démarre pas / se bloque</option><option value="langue">Mauvaise langue ou sous-titres</option><option value="qualite">Problème de son ou d’image</option><option value="episode">Mauvais film ou épisode</option><option value="autre">Autre problème</option>
            </select></label>
            <label className="block text-sm text-paper">Précisions (facultatif)<textarea value={commentaire} onChange={(e) => setCommentaire(e.target.value)} maxLength={1000} rows={4} disabled={etat === 'envoi'} placeholder="Décrivez ce qui se passe…" className="mt-2 w-full rounded-lg border border-ink-600 bg-ink-950 p-3 text-paper" /></label>
            <p className="text-xs leading-relaxed text-haze-400">Le titre, l’épisode et votre message seront transmis à l’administration de Lucarne. N’indiquez aucun mot de passe ni renseignement personnel.</p>
            {erreur && <p role="alert" className="text-sm text-lamp-500">{erreur}</p>}
            <button type="submit" disabled={etat === 'envoi'} className="min-h-11 rounded-full bg-lamp-500 px-5 font-semibold text-ink-950 disabled:opacity-50">{etat === 'envoi' ? 'Envoi…' : 'Envoyer le signalement'}</button>
          </form>}
      </div>
    </div>}
  </>
}
