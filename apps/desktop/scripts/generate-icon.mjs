// Generates build/icon.ico without any third-party dependency, so CI never
// needs a binary asset committed to the repository.
// 256x256 PNG-in-ICO: rounded gradient tile + speech bubble.
import { mkdirSync, writeFileSync } from "node:fs"
import { deflateSync } from "node:zlib"

const SIZE = 256
const SAMPLES = 4 // 4x4 supersampling for smooth edges

const TOP = [124, 92, 255]
const BOTTOM = [37, 99, 235]
const WHITE = [255, 255, 255]

function gradient(y) {
  const t = Math.min(Math.max(y / SIZE, 0), 1)
  return [
    Math.round(TOP[0] + (BOTTOM[0] - TOP[0]) * t),
    Math.round(TOP[1] + (BOTTOM[1] - TOP[1]) * t),
    Math.round(TOP[2] + (BOTTOM[2] - TOP[2]) * t),
  ]
}

/** Signed distance to a rounded rectangle. */
function roundedRect(px, py, cx, cy, halfW, halfH, radius) {
  const qx = Math.abs(px - cx) - (halfW - radius)
  const qy = Math.abs(py - cy) - (halfH - radius)
  const outside = Math.hypot(Math.max(qx, 0), Math.max(qy, 0))
  return outside + Math.min(Math.max(qx, qy), 0) - radius
}

function inTriangle(px, py, ax, ay, bx, by, cx, cy) {
  const d1 = (px - bx) * (ay - by) - (ax - bx) * (py - by)
  const d2 = (px - cx) * (by - cy) - (bx - cx) * (py - cy)
  const d3 = (px - ax) * (cy - ay) - (cx - ax) * (py - ay)
  const hasNeg = d1 < 0 || d2 < 0 || d3 < 0
  const hasPos = d1 > 0 || d2 > 0 || d3 > 0
  return !(hasNeg && hasPos)
}

function sample(x, y) {
  // Background tile
  if (roundedRect(x, y, 128, 128, 120, 120, 56) > 0) return null

  const base = gradient(y)

  // Speech bubble body + tail
  const bubble = roundedRect(x, y, 128, 112, 78, 54, 26) <= 0
  const tail = inTriangle(x, y, 96, 158, 142, 158, 100, 206)
  if (!bubble && !tail) return base

  // Three dots inside the bubble, punched back to the gradient colour.
  for (const cx of [98, 128, 158]) {
    if (Math.hypot(x - cx, y - 112) <= 9.5) return gradient(y + 40)
  }
  return WHITE
}

function renderRgba() {
  const pixels = Buffer.alloc(SIZE * SIZE * 4)
  const step = 1 / SAMPLES
  const total = SAMPLES * SAMPLES

  for (let y = 0; y < SIZE; y += 1) {
    for (let x = 0; x < SIZE; x += 1) {
      let r = 0
      let g = 0
      let b = 0
      let covered = 0

      for (let sy = 0; sy < SAMPLES; sy += 1) {
        for (let sx = 0; sx < SAMPLES; sx += 1) {
          const color = sample(x + (sx + 0.5) * step, y + (sy + 0.5) * step)
          if (!color) continue
          r += color[0]
          g += color[1]
          b += color[2]
          covered += 1
        }
      }

      const offset = (y * SIZE + x) * 4
      if (covered === 0) continue
      pixels[offset] = Math.round(r / covered)
      pixels[offset + 1] = Math.round(g / covered)
      pixels[offset + 2] = Math.round(b / covered)
      pixels[offset + 3] = Math.round((covered / total) * 255)
    }
  }
  return pixels
}

// --- PNG encoding -----------------------------------------------------------

const CRC_TABLE = (() => {
  const table = new Int32Array(256)
  for (let n = 0; n < 256; n += 1) {
    let c = n
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c
  }
  return table
})()

function crc32(buffer) {
  let crc = -1
  for (let i = 0; i < buffer.length; i += 1) {
    crc = CRC_TABLE[(crc ^ buffer[i]) & 0xff] ^ (crc >>> 8)
  }
  return (crc ^ -1) >>> 0
}

function chunk(type, data) {
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length, 0)
  const typeBuffer = Buffer.from(type, "ascii")
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0)
  return Buffer.concat([length, typeBuffer, data, crc])
}

function encodePng(rgba) {
  const header = Buffer.alloc(13)
  header.writeUInt32BE(SIZE, 0)
  header.writeUInt32BE(SIZE, 4)
  header[8] = 8 // bit depth
  header[9] = 6 // RGBA
  header[10] = 0
  header[11] = 0
  header[12] = 0

  const stride = SIZE * 4
  const raw = Buffer.alloc((stride + 1) * SIZE)
  for (let y = 0; y < SIZE; y += 1) {
    raw[y * (stride + 1)] = 0 // no filter
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride)
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ])
}

function encodeIco(png) {
  const header = Buffer.alloc(6)
  header.writeUInt16LE(0, 0)
  header.writeUInt16LE(1, 2) // type: icon
  header.writeUInt16LE(1, 4) // one image

  const entry = Buffer.alloc(16)
  entry[0] = 0 // 0 means 256
  entry[1] = 0
  entry[2] = 0
  entry[3] = 0
  entry.writeUInt16LE(1, 4) // colour planes
  entry.writeUInt16LE(32, 6) // bits per pixel
  entry.writeUInt32BE(0, 8)
  entry.writeUInt32LE(png.length, 8)
  entry.writeUInt32LE(header.length + entry.length, 12)

  return Buffer.concat([header, entry, png])
}

const png = encodePng(renderRgba())
const ico = encodeIco(png)

const buildDir = new URL("../build/", import.meta.url)
mkdirSync(buildDir, { recursive: true })
writeFileSync(new URL("icon.ico", buildDir), ico)
writeFileSync(new URL("icon.png", buildDir), png)

console.log(`[generate-icon] wrote build/icon.ico (${ico.length} bytes) and build/icon.png`)
