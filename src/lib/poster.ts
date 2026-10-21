/**
 * Deterministic poster artwork.
 *
 * HeiwaStream fournit les affiches de la plupart des titres, par les chemins
 * TMDB de la fiche /media — voir lib/images. Ce module dessine celles qui
 * manquent : un titre sans affiche chez TMDB, une entrée de catalogue que le
 * proxy n'a pas enrichie, une image que le navigateur n'a pas pu charger.
 *
 * L'artwork est dérivé de l'identifiant du titre, donc stable : la même
 * affiche d'une visite à l'autre, sans rien stocker. Mieux qu'un rectangle
 * gris, et mieux qu'une image cassée.
 */

/* ---------- deterministic randomness ---------- */

function hash(str: string): number {
  let h = 2166136261
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function rng(seed: number) {
  let s = seed || 1
  return () => {
    s |= 0
    s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/* ---------- the ink palette ---------- */

type Palette = { bg: string; a: string; b: string }

const PALETTES: Palette[] = [
  { bg: '#0B2E33', a: '#F2A93B', b: '#4FB3A3' }, // deep teal / tungsten
  { bg: '#2E1216', a: '#F0E2C6', b: '#D1563F' }, // oxblood / bone
  { bg: '#141B45', a: '#FF7F5C', b: '#7B87D6' }, // indigo / coral
  { bg: '#11240F', a: '#D9E86B', b: '#4C8C42' }, // forest / chartreuse
  { bg: '#2A1340', a: '#F5BE4D', b: '#A86FD1' }, // plum / gold
  { bg: '#122238', a: '#E0724A', b: '#6FA0D1' }, // slate / rust
  { bg: '#0F1A1E', a: '#6EE7C4', b: '#3D6B78' }, // ink / mint
  { bg: '#37141F', a: '#FFB487', b: '#BF5370' }, // burgundy / apricot
  { bg: '#0C1E33', a: '#FFD15C', b: '#3C7CA8' }, // midnight / straw
  { bg: '#2E2310', a: '#EFD98C', b: '#A17B36' }, // sepia / brass
  { bg: '#1C1430', a: '#BFE83F', b: '#6B4FB0' }, // violet / lime
  { bg: '#1A1512', a: '#FF8A3D', b: '#7A5240' }, // charcoal / flame
]

/* ---------- compositions ---------- */

type Draw = (w: number, h: number, p: Palette, r: () => number) => string

const aperture: Draw = (w, h, p, r) => {
  const cx = w * (0.32 + r() * 0.36)
  const cy = h * (0.3 + r() * 0.28)
  const rad = Math.min(w, h) * (0.28 + r() * 0.16)
  const rings = 3 + Math.floor(r() * 3)
  let out = `<circle cx="${cx}" cy="${cy}" r="${rad}" fill="${p.a}"/>`
  for (let i = 1; i <= rings; i++) {
    out += `<circle cx="${cx}" cy="${cy}" r="${rad + i * rad * 0.3}" fill="none" stroke="${p.b}" stroke-width="${Math.max(2, rad * 0.05)}" opacity="${0.8 - i * 0.13}"/>`
  }
  return out
}

const horizon: Draw = (w, h, p, r) => {
  const y = h * (0.55 + r() * 0.16)
  const sun = Math.min(w, h) * (0.26 + r() * 0.14)
  const cx = w * (0.24 + r() * 0.52)
  let out = `<circle cx="${cx}" cy="${y - sun * 0.3}" r="${sun}" fill="${p.a}"/>`
  out += `<rect x="0" y="${y}" width="${w}" height="${h - y}" fill="${p.b}"/>`
  const bands = 3 + Math.floor(r() * 3)
  for (let i = 0; i < bands; i++) {
    const by = y + (h - y) * ((i + 1) / (bands + 1))
    out += `<rect x="0" y="${by}" width="${w}" height="${Math.max(3, (h - y) * 0.03)}" fill="${p.bg}" opacity="0.6"/>`
  }
  return out
}

const beam: Draw = (w, h, p, r) => {
  const left = r() > 0.5
  return shaft(w, h, p, r, left)
}

/** The light shaft, with a side to fall from. */
function shaft(w: number, h: number, p: Palette, r: () => number, fromLeft: boolean): string {
  const ox = fromLeft ? 0 : w
  const tx = fromLeft ? w : 0
  const spread = 4 + Math.floor(r() * 3)
  let out = ''
  for (let i = 0; i < spread; i++) {
    const y1 = h * (0.05 + (i / spread) * 0.5)
    const y2 = h * (0.4 + (i / spread) * 0.85)
    out += `<polygon points="${ox},${h * -0.08} ${tx},${y1} ${tx},${y2}" fill="${i % 2 ? p.a : p.b}" opacity="${0.26 + i * 0.1}"/>`
  }
  out += `<circle cx="${ox}" cy="${h * -0.01}" r="${Math.min(w, h) * 0.12}" fill="${p.a}"/>`
  return out
}

const arch: Draw = (w, h, p, r) => {
  const pad = w * (0.13 + r() * 0.08)
  const top = h * (0.16 + r() * 0.12)
  const base = h * 0.84
  const rad = (w - pad * 2) / 2
  let out = `<path d="M ${pad} ${base} L ${pad} ${top + rad} A ${rad} ${rad} 0 0 1 ${w - pad} ${top + rad} L ${w - pad} ${base} Z" fill="${p.a}"/>`
  const inner = rad * (0.42 + r() * 0.24)
  out += `<path d="M ${w / 2 - inner} ${base} L ${w / 2 - inner} ${top + rad + inner * 0.3} A ${inner} ${inner} 0 0 1 ${w / 2 + inner} ${top + rad + inner * 0.3} L ${w / 2 + inner} ${base} Z" fill="${p.bg}"/>`
  out += `<rect x="0" y="${base}" width="${w}" height="${h - base}" fill="${p.b}"/>`
  return out
}

const strata: Draw = (w, h, p, r) => {
  const n = 6 + Math.floor(r() * 6)
  let y = 0
  let out = ''
  for (let i = 0; i < n; i++) {
    const t = (h / n) * (0.5 + r() * 1.2)
    out += `<rect x="0" y="${y}" width="${w}" height="${t}" fill="${i % 3 === 0 ? p.a : i % 3 === 1 ? p.b : p.bg}"/>`
    y += t
    if (y > h) break
  }
  const cx = w * (0.5 + (r() - 0.5) * 0.44)
  out += `<circle cx="${cx}" cy="${h * (0.34 + r() * 0.26)}" r="${Math.min(w, h) * 0.18}" fill="${p.bg}" opacity="0.9"/>`
  return out
}

const eclipse: Draw = (w, h, p, r) => {
  const rad = Math.min(w, h) * (0.3 + r() * 0.12)
  const cx = w * 0.5
  const cy = h * (0.4 + r() * 0.18)
  const off = rad * (0.5 + r() * 0.6)
  return (
    `<circle cx="${cx - off / 2}" cy="${cy}" r="${rad}" fill="${p.a}"/>` +
    `<circle cx="${cx + off / 2}" cy="${cy}" r="${rad}" fill="${p.b}" opacity="0.85"/>` +
    `<rect x="0" y="${cy + rad * 1.55}" width="${w}" height="${Math.max(4, h * 0.012)}" fill="${p.a}"/>`
  )
}

const peaks: Draw = (w, h, p, r) => {
  const base = h * (0.7 + r() * 0.1)
  const n = 2 + Math.floor(r() * 3)
  let out = `<circle cx="${w * (0.18 + r() * 0.64)}" cy="${h * 0.24}" r="${Math.min(w, h) * 0.14}" fill="${p.a}"/>`
  for (let i = 0; i < n; i++) {
    const px = w * ((i + 0.5) / n) + (r() - 0.5) * w * 0.22
    const ph = h * (0.26 + r() * 0.3)
    const pw = w * (0.32 + r() * 0.24)
    out += `<polygon points="${px - pw},${base} ${px},${base - ph} ${px + pw},${base}" fill="${i % 2 ? p.b : p.a}" opacity="${0.85 - i * 0.14}"/>`
  }
  out += `<rect x="0" y="${base}" width="${w}" height="${h - base}" fill="${p.b}"/>`
  return out
}

const split: Draw = (w, h, p, r) => {
  const skew = (r() - 0.5) * w * 0.9
  const mid = h * (0.38 + r() * 0.26)
  let out = `<polygon points="0,0 ${w},0 ${w},${mid - skew} 0,${mid + skew}" fill="${p.a}" opacity="0.92"/>`
  out += `<polygon points="0,${mid + skew} ${w},${mid - skew} ${w},${h} 0,${h}" fill="${p.bg}"/>`
  out += `<polygon points="0,${mid + skew} ${w},${mid - skew} ${w},${h} 0,${h}" fill="${p.b}" opacity="0.5"/>`
  const cx = w * (0.26 + r() * 0.48)
  out += `<circle cx="${cx}" cy="${mid + skew * (cx / w - 0.5) * -2}" r="${Math.min(w, h) * 0.15}" fill="${p.bg}"/>`
  return out
}

const columns: Draw = (w, h, p, r) => {
  let x = 0
  let i = 0
  let out = ''
  while (x < w) {
    const cw = w * (0.04 + r() * 0.14)
    const top = h * r() * 0.3
    out += `<rect x="${x}" y="${top}" width="${cw}" height="${h - top}" fill="${i % 3 === 0 ? p.a : i % 3 === 1 ? p.b : p.bg}" opacity="${0.72 + r() * 0.28}"/>`
    x += cw
    i++
  }
  const ry = h * (0.52 + r() * 0.24)
  out += `<rect x="0" y="${ry}" width="${w}" height="${Math.max(4, h * 0.014)}" fill="${p.bg}"/>`
  return out
}

const orbit: Draw = (w, h, p, r) => {
  const cx = w * (0.4 + r() * 0.2)
  const cy = h * (0.38 + r() * 0.16)
  const rad = Math.min(w, h) * (0.32 + r() * 0.1)
  const ang = r() * Math.PI * 2
  const dot = Math.min(w, h) * (0.07 + r() * 0.05)
  return (
    `<circle cx="${cx}" cy="${cy}" r="${rad}" fill="none" stroke="${p.b}" stroke-width="${Math.max(2, rad * 0.045)}"/>` +
    `<circle cx="${cx + Math.cos(ang) * rad}" cy="${cy + Math.sin(ang) * rad}" r="${dot}" fill="${p.a}"/>` +
    `<circle cx="${cx}" cy="${cy}" r="${rad * 0.16}" fill="${p.a}" opacity="0.65"/>`
  )
}

const wave: Draw = (w, h, p, r) => {
  const n = 5 + Math.floor(r() * 5)
  const amp = h * (0.05 + r() * 0.06)
  let out = ''
  for (let i = 0; i < n; i++) {
    const y = h * (0.16 + (i / n) * 0.72)
    const dir = i % 2 ? 1 : -1
    out += `<path d="M 0 ${y} Q ${w * 0.25} ${y + amp * dir} ${w * 0.5} ${y} T ${w} ${y}" fill="none" stroke="${i % 2 ? p.a : p.b}" stroke-width="${Math.max(3, h * 0.016)}" opacity="${0.5 + (i / n) * 0.5}"/>`
  }
  out += `<circle cx="${w * (0.3 + r() * 0.4)}" cy="${h * (0.2 + r() * 0.2)}" r="${Math.min(w, h) * 0.12}" fill="${p.a}"/>`
  return out
}

const lattice: Draw = (w, h, p, r) => {
  const cols = 4 + Math.floor(r() * 4)
  const rows = Math.max(3, Math.round((cols * h) / w))
  const cw = w / cols
  const ch = h / rows
  const hotC = Math.floor(r() * cols)
  const hotR = Math.floor(r() * rows)
  let out = ''
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const isHot = x === hotC && y === hotR
      const s = Math.min(cw, ch) * (isHot ? 0.95 : 0.48 + r() * 0.26)
      out += `<circle cx="${cw * (x + 0.5)}" cy="${ch * (y + 0.5)}" r="${s / 2}" fill="${isHot ? p.a : p.b}" opacity="${isHot ? 1 : 0.5 + r() * 0.35}"/>`
    }
  }
  return out
}

const COMPOSITIONS: Draw[] = [
  aperture, horizon, beam, arch, strata, eclipse, peaks, split, columns, orbit, wave, lattice,
]

/**
 * Compositions that hold a 16:9 banner. The sparse ones read as empty, and the
 * radially symmetric ones (eclipse) leave a wide frame unfilled.
 */
const WIDE_COMPOSITIONS: Draw[] = [beam, horizon, peaks, aperture, strata, split, columns]

/* ---------- le choix de la composition ----------
 * Une version précédente répartissait les compositions en parcourant tout le
 * catalogue d'avance, pour qu'un mur d'affiches ne se répète pas. Le
 * catalogue est maintenant distant et paginé : il n'existe plus de liste
 * complète à parcourir, et une page de cinquante titres ne sait rien des
 * quarante-huit mille autres.
 *
 * Le choix se fait donc sur l'empreinte de l'identifiant seule. Deux
 * conséquences : il reste stable — le même titre garde son affiche d'une
 * visite à l'autre, et d'un appareil à l'autre — et il se regroupe un peu
 * plus qu'avant. Sur une grille de cinquante titres tirés de douze palettes
 * et d'une dizaine de compositions, cela ne se voit pas.
 */

function pick<T>(pool: T[], seed: string, _id: string): T {
  return pool[hash(`${seed}|c`) % pool.length]!
}

/* ---------- assembly ---------- */

function build(seed: string, id: string, w: number, h: number, pool = COMPOSITIONS): string {
  const base = hash(seed)
  const r = rng(base)
  const palette = PALETTES[base % PALETTES.length]!
  const draw = pick(pool, seed, id)

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">` +
    `<defs>` +
    `<filter id="g"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="4"/><feColorMatrix type="saturate" values="0"/></filter>` +
    `<linearGradient id="v" x1="0" y1="0" x2="0" y2="1">` +
    `<stop offset="0%" stop-color="#04070F" stop-opacity="0.28"/>` +
    `<stop offset="62%" stop-color="#04070F" stop-opacity="0"/>` +
    `<stop offset="100%" stop-color="#04070F" stop-opacity="0.66"/>` +
    `</linearGradient>` +
    `</defs>` +
    `<rect width="${w}" height="${h}" fill="${palette.bg}"/>` +
    draw(w, h, palette, r) +
    (h / w < 0.8 ? '' : `<rect width="${w}" height="${h}" fill="url(#v)"/>`) +
    `<rect width="${w}" height="${h}" filter="url(#g)" opacity="0.16" style="mix-blend-mode:overlay"/>` +
    `</svg>`

  return 'data:image/svg+xml,' + encodeURIComponent(svg)
}

const cache = new Map<string, string>()

function memo(seed: string, id: string, w: number, h: number, pool?: Draw[]): string {
  const k = `${seed}:${w}x${h}`
  let v = cache.get(k)
  if (!v) {
    v = build(seed, id, w, h, pool)
    cache.set(k, v)
  }
  return v
}

/** 2:3 poster artwork for a catalogue entry. */
export function posterArt(id: string): string {
  return memo(id, id, 600, 900)
}

/** 16:9 backdrop artwork — hero banners and resumable cards. */
export function backdropArt(id: string): string {
  return memo(`${id}~wide`, id, 1600, 900, WIDE_COMPOSITIONS)
}

/**
 * Banner artwork for the hero and the detail page.
 *
 * Posters vary their composition on purpose; banners do not. Every banner is
 * the same light shaft, in the title's own palette, falling from the right so
 * the left side stays open for the title. It is the house treatment for the
 * one image people see largest, and it is the thing the name refers to.
 */
export function bannerArt(id: string): string {
  const seed = `${id}~banner`
  const k = `${seed}:banner`
  let v = cache.get(k)
  if (!v) {
    const base = hash(seed)
    const r = rng(base)
    const palette = PALETTES[base % PALETTES.length]!
    const w = 1600
    const h = 900
    const svg =
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">` +
      `<defs><filter id="g"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="4"/>` +
      `<feColorMatrix type="saturate" values="0"/></filter></defs>` +
      `<rect width="${w}" height="${h}" fill="${palette.bg}"/>` +
      shaft(w, h, palette, r, false) +
      `<rect width="${w}" height="${h}" filter="url(#g)" opacity="0.14" style="mix-blend-mode:overlay"/>` +
      `</svg>`
    v = 'data:image/svg+xml,' + encodeURIComponent(svg)
    cache.set(k, v)
  }
  return v
}

/** The dominant ink of a title, for tinting glows and hero gradients. */
export function accentOf(id: string): string {
  return PALETTES[hash(id) % PALETTES.length]!.a
}
