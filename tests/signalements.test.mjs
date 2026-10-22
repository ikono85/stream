import { test, after } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, copyFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

const temporaire = await mkdtemp(join(tmpdir(), 'lucarne-signalements-'))
await mkdir(join(temporaire, 'server'))
for (const fichier of ['securite.mjs', 'signalements.mjs']) {
  await copyFile(new URL(`../server/${fichier}`, import.meta.url), join(temporaire, 'server', fichier))
}
const { serviSignalement, listeSignalements } = await import(pathToFileURL(join(temporaire, 'server/signalements.mjs')))
after(() => rm(temporaire, { recursive: true, force: true }))
const corps = { entryId: 'tv-123', titre: 'Série test', episodeId: 'tv-123-s1e2', motif: 'lecture', commentaire: 'Vidéo bloquée' }
let numero = 1
async function requete(donnees, entetes = {}, ip = `192.0.2.${numero++}`) {
  const req = { method: 'POST', headers: { host: 'localhost:5173', origin: 'http://localhost:5173', 'content-type': 'application/json', ...entetes }, socket: { remoteAddress: ip } }
  const res = { setHeader() {}, end(texte) { this.corps = JSON.parse(texte) } }
  await serviSignalement(req, res, async () => donnees)
  return res
}
test('un signalement est conservé avec le bon épisode sans adresse ni compte', async () => {
  assert.equal((await requete(corps)).statusCode, 201)
  const [s] = listeSignalements()
  assert.equal(s.episodeId, corps.episodeId)
  assert.equal(s.commentaire, corps.commentaire)
  assert.equal('ip' in s, false)
  assert.equal('compte' in s, false)
})
test('les données invalides et les requêtes provenant d’un autre site sont refusées', async () => {
  for (const changements of [{ entryId: '../secret' }, { motif: 'inconnu' }, { commentaire: 'a'.repeat(1001) }, { episodeId: 'tv-999-s1e2' }]) {
    assert.equal((await requete({ ...corps, ...changements })).statusCode, 400)
  }
  assert.equal((await requete(corps, { origin: 'https://autre.example' })).statusCode, 403)
  assert.equal((await requete(corps, { 'content-type': 'text/plain' })).statusCode, 403)
})
test('les envois répétés sont limités', async () => {
  for (let i = 0; i < 5; i++) assert.equal((await requete(corps, {}, '192.0.2.200')).statusCode, 201)
  assert.equal((await requete(corps, {}, '192.0.2.200')).statusCode, 429)
})
