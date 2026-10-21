import { useCallback, useEffect, useState } from 'react'
import { Carte, dateHeure, nombre } from '@/admin/commun'

/**
 * LES COMPTES
 * ===========
 * Qui s'est inscrit, quand, et ce qu'il a fait. Avec de quoi agir : fermer
 * les inscriptions, suspendre, remettre un mot de passe, effacer un
 * historique, supprimer un compte.
 *
 * Deux gestes sont séparés à dessein. **Effacer l'historique** ne touche pas
 * au compte : c'est ce qu'on fait quand quelqu'un le demande. **Supprimer le
 * compte** emporte tout, y compris les traces — un compte effacé qui
 * laisserait derrière lui un historique nominatif serait le pire des deux
 * mondes.
 */

interface Compte {
  id: string
  nom: string
  role: string
  creeA: string
  derniereConnexionA: string | null
  suspendu: boolean
  creeDepuis: string | null
}

interface Activite {
  a: string
  type: string
  titre?: string
  terme?: string
  ip: string
  appareil: string
  episode?: string
}

const petitBouton = 'rounded-full border border-ink-600 px-3 py-1.5 text-xs text-haze-300 transition-colors hover:border-haze-400 hover:text-paper'
const boutonRouge = 'rounded-full border border-[#D1563F]/50 px-3 py-1.5 text-xs text-[#F0B7A8] transition-colors hover:bg-[#D1563F]/10'

export function Comptes() {
  const [comptes, setComptes] = useState<Compte[]>([])
  const [inscriptionOuverte, setInscriptionOuverte] = useState(true)
  const [charge, setCharge] = useState(true)
  const [ouvert, setOuvert] = useState<string | null>(null)
  const [activite, setActivite] = useState<Activite[]>([])
  const [confirme, setConfirme] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const recharge = useCallback(async () => {
    setCharge(true)
    try {
      const r = await fetch('/api/admin/comptes')
      if (r.ok) {
        const d = (await r.json()) as { comptes: Compte[]; reglages: { inscriptionOuverte: boolean } }
        setComptes(d.comptes)
        setInscriptionOuverte(d.reglages.inscriptionOuverte)
      }
    } finally {
      setCharge(false)
    }
  }, [])

  useEffect(() => { void recharge() }, [recharge])

  async function ouvre(id: string) {
    if (ouvert === id) { setOuvert(null); return }
    setOuvert(id)
    setActivite([])
    const r = await fetch(`/api/admin/comptes/${id}`)
    if (r.ok) setActivite(((await r.json()) as { activite: Activite[] }).activite)
  }

  async function bascule(ouverte: boolean) {
    await fetch('/api/admin/reglages', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ inscriptionOuverte: ouverte }),
    })
    setInscriptionOuverte(ouverte)
  }

  async function agis(id: string, action: 'suspendre' | 'reprendre' | 'traces' | 'supprimer' | 'motdepasse') {
    setMessage(null)
    if (action === 'suspendre' || action === 'reprendre') {
      await fetch(`/api/admin/comptes/${id}/suspension`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ suspendu: action === 'suspendre' }),
      })
    }
    if (action === 'traces') {
      const r = await fetch(`/api/admin/comptes/${id}/traces`, { method: 'DELETE' })
      const d = (await r.json()) as { tracesRetirees: number }
      setMessage(`${d.tracesRetirees} entrée(s) d'historique effacée(s).`)
      if (ouvert === id) setActivite([])
    }
    if (action === 'supprimer') {
      await fetch(`/api/admin/comptes/${id}`, { method: 'DELETE' })
      setMessage('Compte supprimé, avec sa bibliothèque et son historique.')
      setOuvert(null)
    }
    if (action === 'motdepasse') {
      const nouveau = window.prompt('Nouveau mot de passe (huit caractères au minimum) :')
      if (!nouveau) return
      const r = await fetch(`/api/admin/comptes/${id}/motdepasse`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nouveau }),
      })
      const d = (await r.json()) as { ok: boolean; message?: string }
      setMessage(d.ok ? 'Mot de passe remis. Communiquez-le à la personne, qui pourra le changer.' : (d.message ?? 'Échec.'))
    }
    setConfirme(null)
    await recharge()
  }

  return (
    <div className="grid gap-4">
      <Carte
        titre="Inscriptions"
        action={
          <button
            type="button"
            onClick={() => void bascule(!inscriptionOuverte)}
            className={inscriptionOuverte ? petitBouton : 'rounded-full bg-lamp-500 px-3 py-1.5 text-xs font-semibold text-ink-950'}
          >
            {inscriptionOuverte ? 'Fermer les inscriptions' : 'Rouvrir les inscriptions'}
          </button>
        }
      >
        <p className="text-sm text-haze-300">
          {inscriptionOuverte
            ? "N'importe qui connaissant l'adresse du site peut créer un compte. Trois comptes par heure et par adresse IP au maximum."
            : 'La création de comptes est fermée. Les comptes existants continuent de fonctionner.'}
        </p>
      </Carte>

      {message && (
        <p className="rounded-[var(--radius-panel)] border border-ink-600 bg-ink-900 p-3 text-sm text-lamp-500">
          {message}
        </p>
      )}

      <Carte titre={`Comptes (${nombre.format(comptes.length)})`}>
        {charge && comptes.length === 0 && <p className="text-sm text-haze-400">Chargement…</p>}

        {!charge && comptes.length === 0 && (
          <p className="text-sm leading-relaxed text-haze-400">
            Personne ne s'est encore inscrit. Le site reste utilisable sans compte : un compte
            sert à faire suivre sa liste d'un appareil à l'autre.
          </p>
        )}

        <ul className="divide-y divide-ink-700">
          {comptes.map((compte) => (
            <li key={compte.id} className="py-3">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                <button
                  type="button"
                  onClick={() => void ouvre(compte.id)}
                  className="min-w-0 flex-1 text-left"
                >
                  <span className="flex items-center gap-2">
                    <span className="truncate font-wide font-semibold text-paper">{compte.nom}</span>
                    {compte.suspendu && (
                      <span className="shrink-0 rounded-full bg-[#D1563F]/15 px-2 py-0.5 text-[0.6rem] font-bold uppercase tracking-[0.08em] text-[#F0B7A8]">
                        suspendu
                      </span>
                    )}
                  </span>
                  <span className="mt-0.5 block text-xs text-haze-400 nums-tabular">
                    inscrit le {dateHeure.format(new Date(compte.creeA))}
                    {compte.derniereConnexionA && ` · vu le ${dateHeure.format(new Date(compte.derniereConnexionA))}`}
                    {compte.creeDepuis && ` · depuis ${compte.creeDepuis}`}
                  </span>
                </button>

                <div className="flex flex-wrap items-center gap-1.5">
                  <button type="button" onClick={() => void ouvre(compte.id)} className={petitBouton}>
                    {ouvert === compte.id ? 'Masquer' : 'Activité'}
                  </button>
                  <button type="button" onClick={() => void agis(compte.id, 'motdepasse')} className={petitBouton}>
                    Mot de passe
                  </button>
                  <button
                    type="button"
                    onClick={() => void agis(compte.id, compte.suspendu ? 'reprendre' : 'suspendre')}
                    className={petitBouton}
                  >
                    {compte.suspendu ? 'Réactiver' : 'Suspendre'}
                  </button>
                  <button type="button" onClick={() => void agis(compte.id, 'traces')} className={petitBouton}>
                    Effacer l'historique
                  </button>
                  {confirme === compte.id ? (
                    <>
                      <button type="button" onClick={() => void agis(compte.id, 'supprimer')} className="rounded-full bg-[#D1563F] px-3 py-1.5 text-xs font-semibold text-paper">
                        Confirmer
                      </button>
                      <button type="button" onClick={() => setConfirme(null)} className="px-2 text-xs text-haze-400 hover:text-paper">
                        Annuler
                      </button>
                    </>
                  ) : (
                    <button type="button" onClick={() => setConfirme(compte.id)} className={boutonRouge}>
                      Supprimer
                    </button>
                  )}
                </div>
              </div>

              {ouvert === compte.id && (
                <div className="mt-3 rounded-[var(--radius-panel)] border border-ink-700 bg-ink-950/60 p-3">
                  {activite.length === 0 ? (
                    <p className="text-sm text-haze-400">Aucune activité enregistrée pour ce compte.</p>
                  ) : (
                    <ul className="divide-y divide-ink-700">
                      {activite.slice(0, 40).map((e, i) => (
                        <li key={`${e.a}-${i}`} className="flex items-baseline gap-3 py-1.5 text-sm">
                          <span className="w-28 shrink-0 text-xs text-haze-400 nums-tabular">
                            {dateHeure.format(new Date(e.a))}
                          </span>
                          <span className="w-20 shrink-0 text-xs text-haze-300">{e.type}</span>
                          <span className="min-w-0 flex-1 truncate text-haze-200">
                            {e.titre ?? e.terme ?? ''}
                            {e.episode ? <span className="text-haze-400"> · {e.episode}</span> : null}
                          </span>
                          <span className="hidden w-32 shrink-0 truncate text-xs text-haze-400 nums-tabular sm:block">{e.ip}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      </Carte>

      <p className="text-xs leading-relaxed text-haze-400">
        « Effacer l'historique » ne touche pas au compte : c'est le geste à faire quand
        quelqu'un vous le demande. « Supprimer » emporte le compte, sa liste, ses reprises et
        son historique — un compte effacé ne doit pas laisser de traces nominatives derrière
        lui. Les deux sont immédiats et sans retour.
      </p>
    </div>
  )
}
