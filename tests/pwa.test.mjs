import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import vm from 'node:vm'
import { deviceGuide, GUIDE_KEY, readGuidePreferences, rememberGuide, shouldShowGuide, SNOOZE_MS } from '../src/lib/install-guide.ts'

function storage() {
  const saved = new Map()
  return { getItem: (key) => saved.get(key) ?? null, setItem: (key, value) => saved.set(key, value) }
}

test('le guide reconnaît Android, iPhone et iPad en mode ordinateur', () => {
  assert.equal(deviceGuide('Windows Chrome'), 'desktop')
  assert.equal(deviceGuide('Linux Android Chrome'), 'android')
  assert.equal(deviceGuide('iPhone Safari'), 'ios')
  assert.equal(deviceGuide('Macintosh Safari', 5), 'ios')
  assert.equal(deviceGuide('Macintosh Safari', 0), 'desktop')
})

test('Plus tard repousse le guide de trois jours, sans le masquer définitivement', () => {
  const s = storage()
  assert.equal(shouldShowGuide(readGuidePreferences(s), 100), true)
  rememberGuide('later', s, 100)
  assert.equal(shouldShowGuide(readGuidePreferences(s), 101), false)
  assert.equal(shouldShowGuide(readGuidePreferences(s), 100 + SNOOZE_MS), true)
})

test('Ne plus afficher et une installation empêchent les invitations automatiques', () => {
  for (const choice of ['never', 'installed']) {
    const s = storage()
    rememberGuide(choice, s, 100)
    rememberGuide('later', s, 200)
    assert.equal(shouldShowGuide(readGuidePreferences(s), 200 + SNOOZE_MS), false)
  }
})

test('le guide tolère un stockage indisponible ou corrompu', () => {
  const s = storage()
  s.setItem(GUIDE_KEY, '{broken')
  assert.equal(shouldShowGuide(readGuidePreferences(s)), true)
  const blocked = { getItem() { throw new Error('blocked') }, setItem() { throw new Error('blocked') } }
  assert.doesNotThrow(() => rememberGuide('never', blocked))
})

const code = await readFile(new URL('../public/sw.js', import.meta.url), 'utf8')

function worker(offline = false) {
  const handlers = {}
  const written = []
  const deleted = []
  const fallback = new Response('Lucarne hors connexion')
  const self = { location: { origin: 'https://lucarne.test' }, addEventListener: (name, handler) => { handlers[name] = handler }, skipWaiting() {}, clients: { async claim() {} } }
  vm.runInNewContext(code, {
    self, URL, Response,
    fetch: async () => { if (offline) throw new Error('offline'); return new Response('online') },
    caches: {
      open: async () => ({ add: async (url) => written.push(url) }),
      keys: async () => ['lucarne-offline-old', 'lucarne-offline-v1', 'other-app'],
      delete: async (key) => deleted.push(key),
      match: async () => fallback,
    },
  })
  return { handlers, written, deleted }
}

test('installation : seule la page hors connexion est mise en cache', async () => {
  const w = worker()
  let done
  w.handlers.install({ waitUntil: (p) => { done = p } })
  await done
  assert.deepEqual(w.written, ['/offline.html'])
  w.handlers.activate({ waitUntil: (p) => { done = p } })
  await done
  assert.deepEqual(w.deleted, ['lucarne-offline-old'])
})

test('les comptes, API, administration et médias sont laissés au réseau', () => {
  const w = worker(true)
  for (const [path, mode, method] of [
    ['/api/compte/moi', 'navigate', 'GET'], ['/api/bibliotheque', 'navigate', 'GET'],
    ['/admin', 'navigate', 'GET'], ['/admin.html', 'navigate', 'GET'],
    ['/api/evenements', 'cors', 'POST'], ['/video.mp4', 'cors', 'GET'],
    ['https://radio.test/live', 'navigate', 'GET'],
  ]) {
    let intercepted = false
    w.handlers.fetch({ request: { url: new URL(path, 'https://lucarne.test').href, mode, method }, respondWith() { intercepted = true } })
    assert.equal(intercepted, false, path)
  }
})

test('la navigation utilise le réseau, puis la page de secours hors connexion', async () => {
  for (const offline of [false, true]) {
    const w = worker(offline)
    let response
    w.handlers.fetch({ request: { url: 'https://lucarne.test/titre/movie-603', mode: 'navigate', method: 'GET' }, respondWith: (p) => { response = p } })
    assert.equal(await (await response).text(), offline ? 'Lucarne hors connexion' : 'online')
  }
})

test('les icônes PNG annoncées par le manifeste ont les bonnes dimensions', async () => {
  const manifest = JSON.parse(await readFile(new URL('../public/manifest.webmanifest', import.meta.url), 'utf8'))
  assert.equal(manifest.display, 'standalone')
  for (const icon of manifest.icons) {
    const png = await readFile(new URL(`../public${icon.src}`, import.meta.url))
    assert.equal(png.subarray(1, 4).toString(), 'PNG')
    assert.equal(`${png.readUInt32BE(16)}x${png.readUInt32BE(20)}`, icon.sizes)
  }
})
