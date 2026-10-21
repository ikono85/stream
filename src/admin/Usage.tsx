import { useCallback, useEffect, useState } from 'react'
import { Carte, Chiffre, Onglet, Palmares, dateHeure, jourCourt, nombre } from '@/admin/commun'

/**
 * CE QUE LES GENS FONT
 * ====================
 * Tout vient du journal d'usage, relu et agrégé à la demande par le serveur.
 *
 * Une limite à garder en tête en lisant ces chiffres : « lecture lancée » ne
 * dit pas « film regardé ». Le lecteur est une iframe de HeiwaStream qui ne
 * rapporte rien, donc ni la durée ni l'achèvement ne sont connaissables. Un
 * titre lancé puis abandonné à la deuxième minute compte comme un titre vu.
 */

interface Resume {
  jours: number
  total: number
  lectures: number
  fiches: number
  recherches: number
  visites: number
  parJour: { jour: string; lectures: number; fiches: number; recherches: number; visiteurs: number }[]
  titresLances: { titre: string; id: string; n: number }[]
  fichesOuvertes: { titre: string; id: string; n: number }[]
  motsCherches: { terme: string; n: number }[]
  appareils: { nom: string; n: number }[]
  adresses: { ip: string; n: number }[]
  dernieres: { a: string; type: string; nom?: string; titre?: string; terme?: string; ip: string; appareil: string; episode?: string }[]
}

const FENETRES = [7, 30, 90] as const

function Histogramme({ parJour }: { parJour: Resume['parJour'] }) {
  if (parJour.length === 0) return <p className="text-sm text-haze-400">Rien encore.</p>
  const sommet = Math.max(1, ...parJour.map((j) => j.lectures + j.fiches))

  return (
    <div className="flex items-end gap-1 overflow-x-auto pb-1" style={{ height: 140 }}>
      {parJour.map((jour) => {
        const hauteur = ((jour.lectures + jour.fiches) / sommet) * 110
        return (
          <div key={jour.jour} className="flex min-w-6 flex-1 flex-col items-center gap-1.5">
            <div className="flex w-full flex-col justify-end" style={{ height: 110 }}>
              {/* Deux teintes empilées : les lectures en clair, les fiches
                  consultées en sourdine. La proportion se lit d'un coup. */}
              <div
                className="w-full rounded-t bg-lamp-500"
                style={{ height: `${(jour.lectures / Math.max(1, jour.lectures + jour.fiches)) * hauteur}px` }}
                title={`${jour.lectures} lecture(s)`}
              />
              <div
                className="w-full bg-ink-600"
                style={{ height: `${(jour.fiches / Math.max(1, jour.lectures + jour.fiches)) * hauteur}px` }}
                title={`${jour.fiches} fiche(s)`}
              />
            </div>
            <span className="whitespace-nowrap text-[0.6rem] text-haze-400 nums-tabular">
              {jourCourt.format(new Date(`${jour.jour}T12:00:00`))}
            </span>
          </div>
        )
      })}
    </div>
  )
}

export function Usage() {
  const [jours, setJours] = useState<number>(7)
  const [resume, setResume] = useState<Resume | null>(null)
  const [charge, setCharge] = useState(true)

  const recharge = useCallback(async (fenetre: number) => {
    setCharge(true)
    try {
      const r = await fetch(`/api/admin/usage?jours=${fenetre}`)
      if (r.ok) setResume((await r.json()) as Resume)
    } finally {
      setCharge(false)
    }
  }, [])

  useEffect(() => { void recharge(jours) }, [jours, recharge])

  if (!resume && charge) return <p className="text-sm text-haze-400">Chargement…</p>
  if (!resume) return <p className="text-sm text-haze-400">Rien à afficher.</p>

  const rien = resume.total === 0

  return (
    <>
      <div className="mb-5 flex items-center gap-3">
        <div className="flex gap-1 rounded-full border border-ink-600 p-1">
          {FENETRES.map((n) => (
            <Onglet key={n} actif={jours === n} onClick={() => setJours(n)}>{n} jours</Onglet>
          ))}
        </div>
        {charge && <span className="text-xs text-haze-400">mise à jour…</span>}
      </div>

      {rien ? (
        <div className="rounded-[var(--radius-panel)] border border-ink-600 bg-ink-900/60 p-8 text-center">
          <p className="font-wide font-bold text-paper">Aucune activité enregistrée</p>
          <p className="mx-auto mt-2 max-w-[52ch] text-sm leading-relaxed text-haze-400">
            Le journal se remplit dès que quelqu'un ouvre une fiche, lance une lecture ou fait
            une recherche. Parcourez le site dans un autre onglet et revenez : vous devriez
            vous y voir.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <Carte titre="En résumé" large>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <Chiffre valeur={nombre.format(resume.visites)} legende="visites" ton="bon" />
              <Chiffre valeur={nombre.format(resume.lectures)} legende="lectures lancées" />
              <Chiffre valeur={nombre.format(resume.fiches)} legende="fiches ouvertes" />
              <Chiffre valeur={nombre.format(resume.recherches)} legende="recherches" />
            </div>
            <p className="mt-4 text-xs leading-relaxed text-haze-400">
              Une visite, c'est une personne — ou une adresse, faute de compte — sur une
              journée. « Lecture lancée » ne dit pas « film regardé » : le lecteur de
              HeiwaStream ne rapporte ni la durée ni la fin.
            </p>
          </Carte>

          <Carte titre="Jour par jour" large>
            <Histogramme parJour={resume.parJour} />
            <p className="mt-2 flex items-center gap-4 text-xs text-haze-400">
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-2 w-3 rounded-sm bg-lamp-500" /> lectures
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-2 w-3 rounded-sm bg-ink-600" /> fiches
              </span>
            </p>
          </Carte>

          <Carte titre="Titres lancés">
            <Palmares
              vide="Aucune lecture sur la période."
              lignes={resume.titresLances.map((t) => ({
                cle: t.id || t.titre,
                libelle: t.titre,
                n: t.n,
                lien: t.id ? `/titre/${t.id}` : undefined,
              }))}
            />
          </Carte>

          <Carte titre="Fiches les plus ouvertes">
            <Palmares
              vide="Aucune fiche consultée."
              lignes={resume.fichesOuvertes.map((t) => ({
                cle: t.id || t.titre,
                libelle: t.titre,
                n: t.n,
                lien: t.id ? `/titre/${t.id}` : undefined,
              }))}
            />
          </Carte>

          <Carte titre="Ce qu'on cherche">
            <Palmares
              vide="Aucune recherche."
              lignes={resume.motsCherches.map((m) => ({ cle: m.terme, libelle: m.terme, n: m.n }))}
            />
            <p className="mt-3 text-xs leading-relaxed text-haze-400">
              Les mots sans résultat sont les plus instructifs : ils disent ce que les gens
              attendent du catalogue et n'y trouvent pas.
            </p>
          </Carte>

          <Carte titre="Appareils">
            <Palmares
              vide="Rien encore."
              lignes={resume.appareils.map((a) => ({ cle: a.nom, libelle: a.nom, n: a.n }))}
            />
          </Carte>

          <Carte titre="Adresses">
            <Palmares
              vide="Rien encore."
              lignes={resume.adresses.map((a) => ({ cle: a.ip, libelle: a.ip, n: a.n }))}
            />
          </Carte>

          <Carte titre="Dernière activité" large>
            <ul className="divide-y divide-ink-700">
              {resume.dernieres.map((e, i) => (
                <li key={`${e.a}-${i}`} className="flex items-baseline gap-3 py-2 text-sm">
                  <span className="w-28 shrink-0 text-xs text-haze-400 nums-tabular">
                    {dateHeure.format(new Date(e.a))}
                  </span>
                  <span className="w-24 shrink-0 text-xs text-haze-300">{e.type}</span>
                  <span className="w-28 shrink-0 truncate text-xs text-lamp-500">{e.nom ?? '—'}</span>
                  <span className="min-w-0 flex-1 truncate text-haze-200">
                    {e.titre ?? e.terme ?? ''}
                    {e.episode ? <span className="text-haze-400"> · {e.episode}</span> : null}
                  </span>
                  <span className="hidden w-32 shrink-0 truncate text-xs text-haze-400 nums-tabular sm:block">
                    {e.ip}
                  </span>
                  <span className="hidden w-20 shrink-0 truncate text-xs text-haze-400 md:block">
                    {e.appareil}
                  </span>
                </li>
              ))}
            </ul>
          </Carte>
        </div>
      )}
    </>
  )
}
