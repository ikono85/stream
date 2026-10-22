import { useRemote } from '@/hooks/useRemote'

interface Signalement { id: string; a: string; entryId: string; titre: string; episodeId: string | null; motif: string; commentaire: string }
const MOTIFS: Record<string, string> = { lecture: 'Lecture impossible', langue: 'Langue / sous-titres', qualite: 'Son / image', episode: 'Mauvais contenu', autre: 'Autre' }

export function Signalements() {
  const result = useRemote(async (signal) => {
    const r = await fetch('/api/admin/signalements', { signal })
    if (!r.ok) throw new Error(r.status === 401 ? 'Session expirée. Reconnectez-vous.' : 'Chargement impossible.')
    return (await r.json() as { entrees: Signalement[] }).entrees
  }, [])
  return <section>
    <div className="flex items-center justify-between gap-3"><h1 className="font-wide text-xl font-bold text-paper">Signalements</h1><button type="button" onClick={result.recharge} className="min-h-11 px-4 text-lamp-500">Actualiser</button></div>
    <p className="mt-2 text-sm text-haze-400">Les 2 000 derniers signalements, du plus récent au plus ancien.</p>
    {result.loading ? <p role="status" className="mt-5 text-haze-400">Chargement…</p> : result.error ? <p role="alert" className="mt-5 text-lamp-500">{result.error.message}</p> : !result.data?.length ? <p className="mt-5 text-haze-300">Aucun signalement pour le moment.</p> : <ul className="mt-5 space-y-3">{result.data.map((s) => <li key={s.id} className="rounded-xl border border-ink-700 p-4">
      <div className="flex flex-wrap justify-between gap-2"><a href={`/titre/${s.entryId}`} className="font-semibold text-paper hover:text-lamp-500">{s.titre}</a><time className="text-xs text-haze-400">{new Date(s.a).toLocaleString('fr-FR')}</time></div>
      <p className="mt-1 text-sm text-lamp-500">{MOTIFS[s.motif] ?? s.motif}{s.episodeId ? ` · ${s.episodeId.split('-').at(-1)?.toUpperCase()}` : ''}</p>
      {s.commentaire && <p className="mt-3 whitespace-pre-wrap break-words text-sm text-haze-300">{s.commentaire}</p>}
    </li>)}</ul>}
  </section>
}
