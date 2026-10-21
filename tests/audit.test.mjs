import { test, after } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, copyFile, readFile, writeFile, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve, sep } from 'node:path'
import { pathToFileURL } from 'node:url'
import { reprisesParTitre, lectureCommencee } from '../src/lib/progression.ts'

// Modules serveur copiés : aucune écriture dans les vrais comptes ou journaux.
const temporaire = await mkdtemp(join(tmpdir(), 'lucarne-audit-tests-'))
await mkdir(join(temporaire, 'server'))
for (const file of ['securite.mjs', 'comptes.mjs', 'evenements.mjs']) {
  await copyFile(new URL(`../server/${file}`, import.meta.url), join(temporaire, 'server', file))
}
await copyFile(new URL('../src/lib/storage.ts', import.meta.url), join(temporaire, 'storage.ts'))
const repriseSource = await readFile(new URL('../src/lib/reprise-locale.ts', import.meta.url), 'utf8')
await writeFile(join(temporaire, 'reprise.ts'), repriseSource.replace("'@/lib/storage'", "'./storage.ts'"))
const charge = (file) => import(pathToFileURL(join(temporaire, file)).href)
const comptes = await charge('server/comptes.mjs')
const securite = await charge('server/securite.mjs')
const journaux = await charge('server/evenements.mjs')
const { verseDansLeCompte } = await charge('reprise.ts')
const { store } = await charge('storage.ts')

after(async () => {
  assert.ok(resolve(temporaire).startsWith(resolve(tmpdir()) + sep))
  await rm(temporaire, { recursive: true, force: true })
})

const req = (cookie) => ({ headers: { cookie }, socket: { remoteAddress: '192.0.2.123' } })
const cookiePour = (compte) => comptes.cookieDeSession(req(''), compte).split(';')[0]

test('changer puis réinitialiser le mot de passe révoque toutes les anciennes sessions', () => {
  const compte = comptes.inscrit({ nom: 'Test Sessions', motDePasse: 'ancien-test-123', ip: 'test' }).compte
  const ancien = cookiePour(compte)
  const autreAppareil = cookiePour(compte)
  assert.ok(comptes.compteDe(req(ancien)))
  const resultat = comptes.changeMotDePasse({ id: compte.id, actuel: 'ancien-test-123', nouveau: 'nouveau-test-456' })
  assert.equal(resultat.erreur, undefined)
  assert.equal(comptes.compteDe(req(ancien)), null)
  assert.equal(comptes.compteDe(req(autreAppareil)), null)
  const nouveau = cookiePour(resultat.compte)
  assert.ok(comptes.compteDe(req(nouveau)))
  assert.equal(comptes.reinitialise(compte.id, 'admin-test-789'), true)
  assert.equal(comptes.compteDe(req(nouveau)), null)
  assert.ok(comptes.compteDe(req(cookiePour(comptes.compteParId(compte.id)))))
})

test('compatibilité des anciennes sessions, puis révocation après changement', () => {
  const compte = comptes.inscrit({ nom: 'Test Legacy', motDePasse: 'ancien-test-123', ip: 'legacy' }).compte
  const cookie = `session=${securite.signeJeton({ id: compte.id }, 60000, 'compte')}`
  assert.ok(comptes.compteDe(req(cookie)))
  comptes.changeMotDePasse({ id: compte.id, actuel: 'ancien-test-123', nouveau: 'nouveau-test-456' })
  assert.equal(comptes.compteDe(req(cookie)), null)
})

test('une reprise conserve sa position et une série ne fournit qu’une carte', () => {
  const ancienne = { entryId: 'tv-1399', episodeId: 'tv-1399-s1e2', seconds: 123, duration: 1200, updatedAt: 20 }
  const commencee = lectureCommencee(ancienne.entryId, ancienne.episodeId, ancienne)
  assert.equal(commencee.seconds, 123)
  assert.equal(commencee.duration, 1200)
  const cartes = reprisesParTitre([
    { ...ancienne, updatedAt: 1, episodeId: undefined }, ancienne,
    { entryId: 'movie-603', seconds: 10, duration: 100, updatedAt: 15 },
  ])
  assert.equal(cartes.length, 2)
  assert.equal(cartes[0].episodeId, ancienne.episodeId)
})

test('l’import s’arrête si la bibliothèque distante ne peut pas être lue', async () => {
  const fetchOriginal = globalThis.fetch
  const calls = []
  globalThis.fetch = async (_url, options) => { calls.push(options?.method ?? 'GET'); return new Response('{}', { status: 503 }) }
  try {
    await assert.rejects(verseDansLeCompte({ maListe: ['movie-603'], progression: [] }), /Impossible de lire/)
    assert.deepEqual(calls, ['GET'])
  } finally { globalThis.fetch = fetchOriginal }
})

test('l’import ne confirme pas un refus HTTP et peut reprendre sans écraser la liste', async () => {
  const fetchOriginal = globalThis.fetch
  let echoue = true
  const bodies = []
  globalThis.fetch = async (_url, options) => {
    if (!options) return Response.json({ maListe: ['movie-1'], progression: [] })
    bodies.push(JSON.parse(options.body))
    return Response.json({}, { status: echoue ? 401 : 200 })
  }
  try {
    const local = { maListe: ['movie-603'], progression: [] }
    await assert.rejects(verseDansLeCompte(local), /sauvegarde a échoué/)
    echoue = false
    assert.deepEqual(await verseDansLeCompte(local), { titres: 1, reprises: 0 })
    assert.deepEqual(bodies.at(-1).ids, ['movie-1', 'movie-603'])
    assert.deepEqual(local.maListe, ['movie-603'])
  } finally { globalThis.fetch = fetchOriginal }
})

test('une panne de stockage local est signalée', async () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { setItem() { throw new Error('quota') } } })
  try { await assert.rejects(store.setMyList('test', ['movie-603']), /ne peut pas enregistrer/) }
  finally {
    if (previous) Object.defineProperty(globalThis, 'localStorage', previous)
    else delete globalThis.localStorage
  }
})

test('les journaux sont bornés par défaut et les nouvelles IP sont tronquées', async () => {
  const previous = process.env.RETENTION_JOURS
  delete process.env.RETENTION_JOURS
  const dossier = join(temporaire, 'donnees', 'evenements')
  await mkdir(dossier, { recursive: true })
  await writeFile(join(dossier, '2000-01-01.jsonl'), '{}\n')
  try {
    assert.equal(journaux.purge(), 1)
    process.env.RETENTION_JOURS = '0'
    await writeFile(join(dossier, '2000-01-01.jsonl'), '{}\n')
    assert.equal(journaux.purge(), 1)
    journaux.consigne(req(''), { type: 'page', chemin: '/test' })
    const [fichier] = await readdir(dossier)
    const ligne = JSON.parse((await readFile(join(dossier, fichier), 'utf8')).trim())
    assert.equal(ligne.ip, '192.0.2.0/24')
    journaux.consigne({ headers: {}, socket: { remoteAddress: '2001:db8::abcd' } }, { type: 'page' })
    const lignes = (await readFile(join(dossier, fichier), 'utf8')).trim().split('\n').map(JSON.parse)
    assert.equal(lignes.at(-1).ip, '2001:db8:0::/48')
  } finally {
    if (previous === undefined) delete process.env.RETENTION_JOURS
    else process.env.RETENTION_JOURS = previous
  }
})
