import { resolveSrv } from 'node:dns/promises'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const cache = new Map()
const enCours = new Map()
let miroirs
let miroirsExpire = 0

async function serveurs() {
  if (miroirs && Date.now() < miroirsExpire) return miroirs
  const records = await resolveSrv('_api._tcp.radio-browser.info')
  const noms = [...new Set(records.map((r) => r.name).filter((n) => /^[a-z0-9-]+\.api\.radio-browser\.info$/i.test(n)))]
  if (!noms.length) throw new Error('Aucun serveur Radio Browser disponible.')
  miroirs = noms.sort(() => Math.random() - 0.5)
  miroirsExpire = Date.now() + 3600_000
  return miroirs
}

/** Métadonnées uniquement : les flux audio restent servis par leurs stations. */
async function appelle(chemin) {
  let derniere
  for (const serveur of await serveurs()) {
    try {
      const response = await fetch(`https://${serveur}/json/${chemin}`, {
        headers: { 'User-Agent': 'Lucarne/1.0 (Radio Browser client)', Accept: 'application/json' },
        signal: AbortSignal.timeout(8000),
      })
      if (!response.ok) throw new Error(`Radio Browser : ${response.status}`)
      return await response.json()
    } catch (error) { derniere = error }
  }
  miroirsExpire = 0
  throw derniere ?? new Error('Radio Browser indisponible.')
}

async function enCache(chemin, duree = 300_000) {
  const connu = cache.get(chemin)
  if (connu && Date.now() < connu.expire) return connu.data
  if (enCours.has(chemin)) return enCours.get(chemin)
  const promesse = appelle(chemin).then((data) => {
    if (cache.size >= 300) cache.delete(cache.keys().next().value)
    cache.set(chemin, { data, expire: Date.now() + duree })
    return data
  }).finally(() => enCours.delete(chemin))
  enCours.set(chemin, promesse)
  return promesse
}

function urlHttp(valeur) {
  try {
    const url = new URL(valeur)
    return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password ? url.href : ''
  } catch { return '' }
}

export function stationPublique(s) {
  if (!s || !UUID.test(s.stationuuid)) return null
  const url = urlHttp(s.url_resolved || s.url)
  if (!url) return null
  return {
    id: s.stationuuid, name: String(s.name || 'Radio sans nom').trim().slice(0, 160), url,
    favicon: urlHttp(s.favicon), homepage: urlHttp(s.homepage),
    country: String(s.country || '').slice(0, 100), countryCode: String(s.countrycode || '').slice(0, 2),
    languages: String(s.language || '').slice(0, 200), tags: String(s.tags || '').split(',').filter(Boolean).slice(0, 6),
    codec: String(s.codec || ''), bitrate: Number(s.bitrate) || 0, hls: s.hls === 1,
  }
}

function repond(res, status, data) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')
  res.end(JSON.stringify(data))
}

export async function serviRadio(req, res) {
  const url = new URL(req.url ?? '/', 'http://local')
  if (!url.pathname.startsWith('/api/radio/')) return false
  try {
    if (url.pathname === '/api/radio/options' && req.method === 'GET') {
      const p = 'hidebroken=true&order=stationcount&reverse=true'
      const [countries, languages, genres] = await Promise.all([
        enCache(`countrycodes?${p}`, 3600_000),
        enCache(`languages?${p}&limit=150`, 3600_000),
        enCache(`tags?${p}&limit=100`, 3600_000),
      ])
      if (![countries, languages, genres].every(Array.isArray)) throw new Error('Filtres Radio Browser invalides.')
      repond(res, 200, { countries, languages, genres })
    } else if (url.pathname === '/api/radio/stations' && req.method === 'GET') {
      let chemin
      const ids = url.searchParams.get('ids')
      if (ids !== null) {
        const propres = [...new Set(ids.split(',').filter((id) => UUID.test(id)))].slice(0, 100)
        if (!propres.length) { repond(res, 200, { stations: [], hasMore: false }); return true }
        chemin = `stations/byuuid?${new URLSearchParams({ uuids: propres.join(',') })}`
      } else {
        const offset = Math.min(10000, Math.max(0, Number(url.searchParams.get('offset')) || 0))
        const params = new URLSearchParams({ hidebroken: 'true', is_https: 'true', limit: '25', offset: String(Math.floor(offset)), order: 'clickcount', reverse: 'true' })
        for (const [depuis, vers] of [['q', 'name'], ['country', 'countrycode'], ['genre', 'tag'], ['language', 'language']]) {
          const valeur = url.searchParams.get(depuis)?.trim().slice(0, 100)
          if (valeur) params.set(vers, valeur)
        }
        if (params.has('tag')) params.set('tagExact', 'true')
        if (params.has('language')) params.set('languageExact', 'true')
        chemin = `stations/search?${params}`
      }
      const data = await enCache(chemin)
      if (!Array.isArray(data)) throw new Error('Réponse Radio Browser invalide.')
      const stations = [...new Map(data.map(stationPublique).filter(Boolean).map((s) => [s.id, s])).values()]
      repond(res, 200, { stations: ids !== null ? stations : stations.slice(0, 24), hasMore: ids === null && data.length === 25 })
    } else if (req.method === 'POST' && UUID.test(url.pathname.slice('/api/radio/click/'.length)) && url.pathname.startsWith('/api/radio/click/')) {
      await appelle(`url/${url.pathname.slice('/api/radio/click/'.length)}`)
      repond(res, 200, { ok: true })
    } else {
      repond(res, 404, { message: 'Route radio inconnue.' })
    }
  } catch {
    repond(res, 503, { message: 'Les stations sont momentanément indisponibles. Réessayez dans un instant.' })
  }
  return true
}

export function middlewareRadio() {
  return (req, res, next) => { void serviRadio(req, res).then((pris) => { if (!pris) next() }).catch(next) }
}
