import { useCallback, useEffect, useState } from 'react'
import { Carte, Chiffre, Onglet, dateHeure, heure, nombre } from '@/admin/commun'
import { Icon } from '@/components/Icon'
import { Usage } from '@/admin/Usage'
import { Comptes } from '@/admin/Comptes'

/**
 * LE TABLEAU DE BORD
 * ==================
 * Première version : surveillance. Il n'affiche que ce que le serveur sait
 * déjà sans rien instrumenter — les compteurs du proxy, l'état du cache, le
 * quota lu dans les en-têtes de HeiwaStream, et le journal des connexions.
 *
 * Ce qu'il n'affiche pas encore, faute d'être collecté : l'usage (fiches
 * ouvertes, lectures lancées, recherches) et les visiteurs. C'est l'étape
 * suivante, et elle demande d'écrire des événements, donc de décider ce
 * qu'on garde et combien de temps.
 */

interface Mesures {
  depuis: string
  secondesEnLigne: number
  api: {
    appels: number
    depuisLeCache: number
    partis: number
    tauxDeCache: number
    servisPerimes: number
    dernierPerime: { a: string; chemin: string } | null
    dureeMoyenneMs: number
    dureeMaxMs: number
    parCode: Record<string, number>
    parRoute: Record<string, number>
  }
  erreurs: { total: number; dernieres: { a: string; chemin: string; code: number | string; message?: string }[] }
  quota: { limite: number | null; restant: number | null; remiseAZero: string | null; vuA: string | null }
  cache: { entrees: number; fiches: number; perimees: number; enVol: number; surDisque: boolean }
  cle: { configuree: boolean; motDePasseAdmin: boolean; accesLocalhost: boolean }
  vous: { ip: string }
}

interface Audit { a: string | null; action: string; ok?: boolean; ip?: string; raison?: string }

const RAFRAICHISSEMENT_MS = 10_000

function duree(secondes: number): string {
  if (secondes < 60) return `${secondes} s`
  if (secondes < 3600) return `${Math.floor(secondes / 60)} min`
  const h = Math.floor(secondes / 3600)
  const m = Math.floor((secondes % 3600) / 60)
  return m ? `${h} h ${m} min` : `${h} h`
}

type Section = 'surveillance' | 'usage' | 'comptes'

export function Admin() {
  const [section, setSection] = useState<Section>('surveillance')
  const [mesures, setMesures] = useState<Mesures | null>(null)
  const [audit, setAudit] = useState<Audit[]>([])
  const [erreur, setErreur] = useState<string | null>(null)
  const [charge, setCharge] = useState(true)

  const recharge = useCallback(async () => {
    try {
      const [m, j] = await Promise.all([
        fetch('/api/admin/mesures').then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status))))),
        fetch('/api/admin/journal?n=30').then((r) => (r.ok ? r.json() : { entrees: [] })),
      ])
      setMesures(m as Mesures)
      setAudit((j as { entrees: Audit[] }).entrees ?? [])
      setErreur(null)
    } catch (e) {
      /* 401 : la session a expiré pendant qu'on regardait. */
      setErreur(String(e).includes('401') ? 'session' : 'reseau')
    } finally {
      setCharge(false)
    }
  }, [])

  useEffect(() => {
    void recharge()
    const id = window.setInterval(() => { void recharge() }, RAFRAICHISSEMENT_MS)
    return () => window.clearInterval(id)
  }, [recharge])

  async function deconnexion() {
    await fetch('/api/admin/session', { method: 'DELETE' })
    location.replace('/')
  }

  if (erreur === 'session') {
    return (
      <main className="grid min-h-dvh place-items-center bg-ink-950 px-6 text-center">
        <div>
          <p className="font-wide text-xl font-bold text-paper">Session expirée</p>
          <p className="mt-2 text-sm text-haze-400">Reconnectez-vous pour continuer.</p>
          <a
            href="/admin"
            className="mt-6 inline-flex h-11 items-center rounded-full bg-lamp-500 px-6 font-semibold text-ink-950"
          >
            Se reconnecter
          </a>
        </div>
      </main>
    )
  }

  const api = mesures?.api
  const quota = mesures?.quota
  const partQuota = quota?.limite && quota.restant !== null
    ? Math.max(0, Math.min(100, (quota.restant / quota.limite) * 100))
    : null

  /* Les codes d'erreur méritent d'être lus séparément des succès. */
  const codes = Object.entries(api?.parCode ?? {}).sort((a, b) => b[1] - a[1])
  const echecs = codes.filter(([code]) => Number(code) >= 400)
  const quotaBas = partQuota !== null && partQuota < 15

  return (
    <div className="min-h-dvh bg-ink-950">
      <header className="border-b border-ink-700">
        <div className="gutter mx-auto flex h-16 max-w-[80rem] items-center gap-4">
          <span className="font-wide text-sm font-extrabold uppercase tracking-[0.14em] text-paper">
            Administration
          </span>
          <div className="flex gap-1 rounded-full border border-ink-600 p-1">
            <Onglet actif={section === 'surveillance'} onClick={() => setSection('surveillance')}>
              Surveillance
            </Onglet>
            <Onglet actif={section === 'usage'} onClick={() => setSection('usage')}>Usage</Onglet>
            <Onglet actif={section === 'comptes'} onClick={() => setSection('comptes')}>Comptes</Onglet>
          </div>

          <div className="ml-auto flex items-center gap-4 text-xs text-haze-400">
            {mesures && <span className="nums-tabular">en ligne depuis {duree(mesures.secondesEnLigne)}</span>}
            <a href="/" className="transition-colors hover:text-paper">Voir le site</a>
            <button
              type="button"
              onClick={() => void deconnexion()}
              className="rounded-full border border-ink-600 px-3 py-1.5 transition-colors hover:border-haze-400 hover:text-paper"
            >
              Déconnexion
            </button>
          </div>
        </div>
      </header>

      <main className="gutter mx-auto max-w-[80rem] py-8">
        {section === 'usage' && <Usage />}
        {section === 'comptes' && <Comptes />}

        {section === 'surveillance' && (
        <>
        {charge && !mesures && <p className="text-sm text-haze-400">Chargement…</p>}

        {erreur === 'reseau' && (
          <p className="mb-6 rounded-[var(--radius-panel)] border border-ink-600 bg-ink-900 p-4 text-sm text-haze-300">
            Le serveur n'a pas répondu au dernier rafraîchissement. Les chiffres ci-dessous datent
            de la dernière réponse reçue.
          </p>
        )}

        {mesures && (
          <>
            {/* Ce qui doit sauter aux yeux avant tout le reste. */}
            {(quotaBas || !mesures.cle.configuree || !mesures.cle.motDePasseAdmin) && (
              <div className="mb-6 space-y-2">
                {quotaBas && (
                  <p className="rounded-[var(--radius-panel)] border border-[#D1563F]/40 bg-[#D1563F]/10 p-4 text-sm text-[#F0B7A8]">
                    Quota presque épuisé : {nombre.format(quota?.restant ?? 0)} requêtes restantes.
                    Le site se dégradera quand il tombera à zéro.
                  </p>
                )}
                {!mesures.cle.configuree && (
                  <p className="rounded-[var(--radius-panel)] border border-[#D1563F]/40 bg-[#D1563F]/10 p-4 text-sm text-[#F0B7A8]">
                    Aucune clé HeiwaStream configurée : le catalogue est vide pour tout le monde.
                  </p>
                )}
                {!mesures.cle.motDePasseAdmin && (
                  <p className="rounded-[var(--radius-panel)] border border-ink-600 bg-ink-900 p-4 text-sm text-haze-300">
                    Aucun mot de passe d'administration : cette page n'est accessible que depuis
                    cette machine. Avant de mettre le site en ligne, lancez{' '}
                    <code className="rounded bg-ink-800 px-1.5 py-0.5 text-paper">npm run admin:motdepasse</code>.
                  </p>
                )}
              </div>
            )}

            <div className="grid gap-4 lg:grid-cols-2">
              <Carte titre="Quota HeiwaStream">
                {quota?.limite ? (
                  <>
                    <div className="flex items-baseline gap-3">
                      <p className={`font-wide text-3xl font-extrabold nums-tabular ${quotaBas ? 'text-[#F0B7A8]' : 'text-paper'}`}>
                        {nombre.format(quota.restant ?? 0)}
                      </p>
                      <p className="text-sm text-haze-400 nums-tabular">
                        sur {nombre.format(quota.limite)}
                      </p>
                    </div>
                    <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-ink-700">
                      <div
                        className={quotaBas ? 'h-full bg-[#D1563F]' : 'h-full bg-lamp-500'}
                        style={{ width: `${partQuota}%` }}
                      />
                    </div>
                    {quota.remiseAZero && (
                      <p className="mt-2 text-xs text-haze-400">
                        Remise à zéro le {dateHeure.format(new Date(quota.remiseAZero))}
                      </p>
                    )}
                  </>
                ) : (
                  <p className="text-sm text-haze-400">
                    Pas encore mesuré : le quota se lit dans les en-têtes de la première réponse
                    de l'API.
                  </p>
                )}
              </Carte>

              <Carte titre="Appels à l'API">
                <div className="grid grid-cols-3 gap-4">
                  <Chiffre valeur={nombre.format(api?.appels ?? 0)} legende="demandes" />
                  <Chiffre
                    valeur={`${api?.tauxDeCache ?? 0} %`}
                    legende="servies par le cache"
                    ton={(api?.tauxDeCache ?? 0) >= 50 ? 'bon' : 'neutre'}
                  />
                  <Chiffre valeur={nombre.format(api?.partis ?? 0)} legende="parties vraiment" />
                </div>
                <p className="mt-4 text-xs text-haze-400 nums-tabular">
                  Durée moyenne {api?.dureeMoyenneMs ?? 0} ms · pic {api?.dureeMaxMs ?? 0} ms
                </p>

                {/* Le site a tenu malgré une panne en face. À signaler : tout
                    allait bien pour le visiteur, pas pour HeiwaStream. */}
                {(api?.servisPerimes ?? 0) > 0 && (
                  <p className="mt-2 flex items-start gap-1.5 text-xs text-lamp-500">
                    <Icon name="info" size={13} className="mt-px shrink-0" />
                    <span>
                      {nombre.format(api?.servisPerimes ?? 0)} réponse(s) servie(s) depuis une
                      copie périmée, l'API étant injoignable
                      {api?.dernierPerime && ` — la dernière à ${heure.format(new Date(api.dernierPerime.a))}`}.
                      Les visiteurs n'ont rien vu.
                    </span>
                  </p>
                )}
                {Object.keys(api?.parRoute ?? {}).length > 0 && (
                  <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-haze-300">
                    {Object.entries(api?.parRoute ?? {})
                      .sort((a, b) => b[1] - a[1])
                      .map(([route, n]) => (
                        <li key={route} className="nums-tabular">
                          {route} <span className="text-haze-400">{nombre.format(n)}</span>
                        </li>
                      ))}
                  </ul>
                )}
              </Carte>

              <Carte titre="Réponses">
                {codes.length === 0 ? (
                  <p className="text-sm text-haze-400">Aucun appel encore parti.</p>
                ) : (
                  <ul className="space-y-1.5">
                    {codes.map(([code, n]) => {
                      const mauvais = Number(code) >= 400
                      return (
                        <li key={code} className="flex items-center justify-between text-sm">
                          <span className={`nums-tabular ${mauvais ? 'text-[#F0B7A8]' : 'text-haze-300'}`}>
                            {code}
                            {code === '429' && <span className="ml-2 text-xs text-haze-400">limite de rafale</span>}
                          </span>
                          <span className="nums-tabular text-paper">{nombre.format(n)}</span>
                        </li>
                      )
                    })}
                  </ul>
                )}
                {echecs.length === 0 && codes.length > 0 && (
                  <p className="mt-3 text-xs text-lamp-500">Aucune réponse en erreur.</p>
                )}
              </Carte>

              <Carte titre="Cache">
                <div className="grid grid-cols-3 gap-4">
                  <Chiffre valeur={nombre.format(mesures.cache.entrees)} legende="entrées" />
                  <Chiffre valeur={nombre.format(mesures.cache.fiches)} legende="fiches gardées" />
                  <Chiffre valeur={nombre.format(mesures.cache.enVol)} legende="requêtes en vol" />
                </div>
                <p className="mt-4 text-xs text-haze-400">
                  {mesures.cache.surDisque
                    ? 'Les fiches survivent à un redémarrage (.cache/heiwa.json).'
                    : 'Cache mémoire seulement : tout repart à zéro au redémarrage.'}
                  {mesures.cache.perimees > 0 && ` ${mesures.cache.perimees} entrée(s) périmée(s) en attente de purge.`}
                </p>
              </Carte>

              <Carte titre="Dernières erreurs" large>
                {mesures.erreurs.dernieres.length === 0 ? (
                  <p className="text-sm text-haze-400">
                    Rien à signaler depuis le démarrage{mesures.erreurs.total === 0 ? '' : ` (${mesures.erreurs.total} au total)`}.
                  </p>
                ) : (
                  <ul className="divide-y divide-ink-700">
                    {mesures.erreurs.dernieres.map((e, i) => (
                      <li key={`${e.a}-${i}`} className="flex items-baseline gap-4 py-2 text-sm">
                        <span className="w-20 shrink-0 text-xs text-haze-400 nums-tabular">
                          {heure.format(new Date(e.a))}
                        </span>
                        <span className="w-12 shrink-0 font-wide text-xs font-bold text-[#F0B7A8] nums-tabular">
                          {e.code}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-haze-300">{e.chemin}</span>
                        {e.message && <span className="shrink-0 text-xs text-haze-400">{e.message}</span>}
                      </li>
                    ))}
                  </ul>
                )}
              </Carte>

              <Carte titre="Connexions à l'administration" large>
                {audit.length === 0 ? (
                  <p className="text-sm text-haze-400">
                    Aucune connexion enregistrée. L'accès depuis cette machine ne passe pas par
                    le mot de passe, donc il n'apparaît pas ici.
                  </p>
                ) : (
                  <ul className="divide-y divide-ink-700">
                    {audit.map((entree, i) => (
                      <li key={`${entree.a}-${i}`} className="flex items-baseline gap-4 py-2 text-sm">
                        <span className="w-28 shrink-0 text-xs text-haze-400 nums-tabular">
                          {entree.a ? dateHeure.format(new Date(entree.a)) : '—'}
                        </span>
                        <span className="w-28 shrink-0 text-haze-300">{entree.action}</span>
                        <span
                          className={`w-40 shrink-0 truncate text-xs ${
                            entree.ok === false ? 'text-[#F0B7A8]' : entree.ok ? 'text-lamp-500' : 'text-haze-400'
                          }`}
                        >
                          {/* « trop_de_tentatives » est plus long que « refusé » :
                              la colonne doit tenir le pire cas, pas le cas moyen. */}
                          {entree.ok === false ? (entree.raison ?? 'refusé') : entree.ok ? 'accepté' : ''}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-xs text-haze-400 nums-tabular">
                          {entree.ip}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </Carte>
            </div>

            <p className="mt-6 text-xs text-haze-400">
              Rafraîchi toutes les {RAFRAICHISSEMENT_MS / 1000} secondes. Les compteurs décrivent
              le processus en cours et repartent à zéro au redémarrage ; le journal des connexions,
              lui, est écrit sur disque. Vous êtes connecté depuis {mesures.vous.ip}.
            </p>
          </>
        )}
        </>
        )}
      </main>
    </div>
  )
}
