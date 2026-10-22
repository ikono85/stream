import { test, after } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, copyFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve, sep } from 'node:path'
import { pathToFileURL } from 'node:url'
import { randomUUID } from 'node:crypto'
import { stationPublique } from '../server/radio.mjs'

const temporaire = await mkdtemp(join(tmpdir(), 'lucarne-radio-tests-'))
await mkdir(join(temporaire, 'server'))
for (const fichier of ['securite.mjs', 'comptes.mjs', 'bibliotheque.mjs', 'compteRoutes.mjs', 'evenements.mjs', 'signalements.mjs']) {
  await copyFile(new URL(`../server/${fichier}`, import.meta.url), join(temporaire, 'server', fichier))
}
const charge = (fichier) => import(pathToFileURL(join(temporaire, 'server', fichier)).href)
const biblio = await charge('bibliotheque.mjs')
const comptes = await charge('comptes.mjs')
const { serviCompteApi } = await charge('compteRoutes.mjs')
after(async () => {
  assert.ok(resolve(temporaire).startsWith(resolve(tmpdir()) + sep))
  await rm(temporaire, { recursive: true, force: true })
})
const alice = comptes.inscrit({ nom: 'Radio Alice', motDePasse: 'Radio-test-123', ip: 'test-a' }).compte
const bob = comptes.inscrit({ nom: 'Radio Bob', motDePasse: 'Radio-test-123', ip: 'test-b' }).compte
const station = randomUUID()
async function route(path, method, compte) {
  const req = { url: path, method, headers: compte ? { cookie: comptes.cookieDeSession({ headers: {} }, compte).split(';')[0] } : {}, socket: { remoteAddress: '127.0.0.1' } }
  const res = { statusCode: 200, setHeader() {}, end(body) { this.body = JSON.parse(body) } }
  assert.equal(await serviCompteApi(req, res), true)
  return res
}

test('normalisation des stations : UUID stable, URL résolue et HLS', () => {
  const s = stationPublique({ stationuuid: station, name: 'Test FM', url: 'https://example.org/ancien', url_resolved: 'https://example.org/direct.m3u8', hls: 1, countrycode: 'FR', bitrate: 128 })
  assert.equal(s.id, station)
  assert.equal(s.url, 'https://example.org/direct.m3u8')
  assert.equal(s.hls, true)
  assert.equal(stationPublique({ stationuuid: station, url: 'javascript:alert(1)' }), null)
  assert.equal(stationPublique({ stationuuid: 'invalid', url: 'https://example.org' }), null)
})
test('les favoris radio nécessitent une session', async () => {
  for (const method of ['GET', 'PUT', 'DELETE']) {
    const r = await route(`/api/bibliotheque/radios${method === 'GET' ? '' : `/${station}`}`, method)
    assert.equal(r.statusCode, 401)
  }
})

test('les épisodes vus sont propres au compte, réversibles et indépendants des reprises', async () => {
  assert.equal((await route('/api/bibliotheque/episodes-vus', 'PUT')).statusCode, 401)
  const celia = comptes.inscrit({ nom: 'Episodes Celia', motDePasse: 'Episodes-test-123', ip: 'test-c' }).compte
  const ep = 'tv-123-s1e2'
  biblio.poseReprise(celia.id, { entryId: 'tv-123', episodeId: ep, seconds: 42, duration: 300 })
  assert.deepEqual(biblio.changeEpisodeVu(celia.id, ep, true), [ep])
  assert.deepEqual(biblio.changeEpisodeVu(celia.id, ep, true), [ep])
  assert.deepEqual(biblio.bibliotheque(bob.id).episodesVus, [])
  biblio.changeListe(celia.id, ['movie-603'])
  biblio.changeFavoriRadio(celia.id, station, true)
  assert.deepEqual(biblio.bibliotheque(celia.id).episodesVus, [ep])
  assert.equal(biblio.bibliotheque(celia.id).progression.find((p) => p.episodeId === ep).seconds, 42)
  assert.equal(biblio.changeEpisodeVu(celia.id, '../secret', true), null)
  assert.equal(biblio.changeEpisodeVu(celia.id, ep, 'oui'), null)
  assert.deepEqual(biblio.changeEpisodeVu(celia.id, ep, false), [])
})
test('ajouter, retrouver et retirer un favori sans le partager avec un autre compte', async () => {
  assert.deepEqual((await route('/api/bibliotheque/radios', 'GET', alice)).body.favorisRadio, [])
  assert.equal((await route(`/api/bibliotheque/radios/${station}`, 'PUT', alice)).statusCode, 200)
  assert.deepEqual((await route('/api/bibliotheque/radios', 'GET', alice)).body.favorisRadio, [station])
  assert.deepEqual((await route('/api/bibliotheque/radios', 'GET', bob)).body.favorisRadio, [])
  await route(`/api/bibliotheque/radios/${station}`, 'PUT', alice)
  assert.deepEqual(biblio.bibliotheque(alice.id).favorisRadio, [station])
  await route(`/api/bibliotheque/radios/${station}`, 'DELETE', alice)
  assert.deepEqual(biblio.bibliotheque(alice.id).favorisRadio, [])
})
test('les favoris conservent liste de films, progression et recherches, et réciproquement', () => {
  biblio.changeListe(alice.id, ['movie-603'])
  biblio.poseReprise(alice.id, { entryId: 'movie-603', seconds: 90, duration: 500 })
  biblio.changeFavoriRadio(alice.id, station, true)
  biblio.changeRecherches(alice.id, ['Matrix'])
  const b = biblio.bibliotheque(alice.id)
  assert.deepEqual(b.maListe, ['movie-603'])
  assert.equal(b.progression[0].seconds, 90)
  assert.deepEqual(b.recherches, ['Matrix'])
  assert.deepEqual(b.favorisRadio, [station])
})
test('les identifiants invalides sont refusés et la limite ne supprime pas les anciens favoris', async () => {
  assert.equal((await route('/api/bibliotheque/radios/invalide', 'PUT', bob)).statusCode, 400)
  const ids = Array.from({ length: 100 }, () => randomUUID())
  for (const id of ids) biblio.changeFavoriRadio(bob.id, id, true)
  assert.equal(biblio.changeFavoriRadio(bob.id, randomUUID(), true), null)
  assert.equal(biblio.bibliotheque(bob.id).favorisRadio.length, 100)
  assert.ok(biblio.bibliotheque(bob.id).favorisRadio.includes(ids[0]))
})
test('la suppression de la bibliothèque efface aussi les favoris radio', () => {
  biblio.effaceBibliotheque(alice.id)
  assert.deepEqual(biblio.bibliotheque(alice.id).favorisRadio, [])
})
