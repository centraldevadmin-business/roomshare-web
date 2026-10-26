// Generates the PWA icons (PNG) with zero dependencies — a hand-rolled PNG
// writer (IHDR/IDAT/IEND + zlib) plus a tiny 2x-supersampled rasterizer.
//
// Outputs (into public/):
//   icon-192.png          — manifest 192px (Android install icon)
//   icon-512.png          — manifest 512px
//   icon-maskable-512.png — maskable: full-bleed background, art in the safe zone
//   apple-touch-icon.png  — 180px for iOS "Add to Home Screen"
//
// The design is the app's brand: an orange gradient tile with a white "plate"
// (circle + inner ring) — the thing the whole house is counting.
//
// Run: node scripts/generate-icons.mjs

import { deflateSync } from 'node:zlib'
import { writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const OUT_DIR = fileURLToPath(new URL('../public/', import.meta.url))

// ---- CRC32 (for PNG chunks) ----
const CRC_TABLE = (() => {
  const t = new Int32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c
  }
  return t
})()
function crc32(buf) {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}
function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([len, body, crc])
}
function encodePng(width, height, rgba) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // color type RGBA
  // each scanline: filter byte 0 + pixels
  const raw = Buffer.alloc(height * (1 + width * 4))
  for (let y = 0; y < height; y++) {
    raw[y * (1 + width * 4)] = 0
    rgba.copy(raw, y * (1 + width * 4) + 1, y * width * 4, (y + 1) * width * 4)
  }
  const idat = deflateSync(raw, { level: 9 })
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))])
}

// ---- Tiny rasterizer (2x supersampled) ----
function hex(h) {
  return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]
}
const TOP = hex('#fb923c')      // orange-400
const BOTTOM = hex('#ea580c')   // orange-600
const PLATE = hex('#ffffff')
const RING = hex('#fdba74')     // orange-300

// Color at normalized coords (x, y) in [0,1]. maskable scales the art into
// the 80% safe zone and keeps the background full-bleed.
function scene(x, y, S, maskable) {
  const t = y
  let r = TOP[0] + (BOTTOM[0] - TOP[0]) * t
  let g = TOP[1] + (BOTTOM[1] - TOP[1]) * t
  let b = TOP[2] + (BOTTOM[2] - TOP[2]) * t
  const k = maskable ? 0.8 : 1 // art scale (safe zone for maskable icons)
  const cx = 0.5, cy = 0.52
  const dx = (x - cx) / k, dy = (y - cy) / k
  const dist = Math.sqrt(dx * dx + dy * dy)
  // plate disc (radius 0.34)
  const plateR = 0.34
  if (dist < plateR) {
    const mix = Math.min(1, Math.max(0, plateR - dist) * S * k * 0.5 + 0.5)
    r = PLATE[0] * mix + r * (1 - mix)
    g = PLATE[1] * mix + g * (1 - mix)
    b = PLATE[2] * mix + b * (1 - mix)
    // inner ring (stroke between radius 0.20 and 0.24)
    const ringIn = 0.2, ringOut = 0.24
    if (dist >= ringIn && dist <= ringOut) {
      const m = Math.min(1, Math.max(0, Math.min(dist - ringIn, ringOut - dist) * S * k * 0.5 + 0.5))
      r = RING[0] * m + PLATE[0] * (1 - m)
      g = RING[1] * m + PLATE[1] * (1 - m)
      b = RING[2] * m + PLATE[2] * (1 - m)
    }
  }
  // rounded corners for non-maskable icons (maskable must be full-bleed)
  if (!maskable) {
    const rad = 0.22
    const px = Math.min(x, 1 - x)
    const py = Math.min(y, 1 - y)
    if (px < rad && py < rad) {
      const qx = rad - px, qy = rad - py
      if (qx * qx + qy * qy > rad * rad) return [0, 0, 0, 0]
    }
  }
  return [Math.round(r), Math.round(g), Math.round(b), 255]
}

function render(size, maskable) {
  const SS = 2
  const big = size * SS
  const out = Buffer.alloc(size * size * 4)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r = 0, g = 0, b = 0, a = 0
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const [pr, pg, pb, pa] = scene((x * SS + sx + 0.5) / big, (y * SS + sy + 0.5) / big, size, maskable)
          const w = pa / 255
          r += pr * w; g += pg * w; b += pb * w; a += w
        }
      }
      const n = SS * SS
      const i = (y * size + x) * 4
      if (a > 0) {
        out[i] = Math.round(r / a)
        out[i + 1] = Math.round(g / a)
        out[i + 2] = Math.round(b / a)
      }
      out[i + 3] = Math.round((a / n) * 255)
    }
  }
  return out
}

const targets = [
  ['icon-192.png', 192, false],
  ['icon-512.png', 512, false],
  ['icon-maskable-512.png', 512, true],
  ['apple-touch-icon.png', 180, false],
]
mkdirSync(OUT_DIR, { recursive: true })
for (const [name, size, maskable] of targets) {
  const png = encodePng(size, size, render(size, maskable))
  const p = join(OUT_DIR, name)
  writeFileSync(p, png)
  console.log(`  ✓ ${name} (${png.length} bytes)`)
}
console.log('Icons written to public/')