/**
 * Generates all PWA branding assets from the family photo in ./icon/image.jpeg:
 *  - App icons (192 / 512 / maskable / apple-touch / favicon / notification)
 *    · Standard icons get rounded corners so they look right on every surface
 *    · Maskable icon is a full-bleed photo so it fills the launcher frame
 *  - iOS splash screens: the family photo alone as a BLURRED full-screen image
 *
 * Run: npx tsx generate-icons.ts   (or: node --experimental-strip-types generate-icons.ts)
 */
import sharp from 'sharp'
import { mkdir } from 'fs/promises'

const SOURCE = 'icon/image.jpeg'
// Launchers add their own circular/squircle masks. A tighter crop keeps the
// family artwork visually large inside those masks instead of looking small.
const ICON_ZOOM = 1.36
async function ensureDirs() {
  await mkdir('public/icons', { recursive: true })
}

/** A centre crop that enlarges the source artwork for launcher icon masks. */
async function zoomedSquare(size: number) {
  const enlarged = Math.ceil(size * ICON_ZOOM)
  const offset = Math.floor((enlarged - size) / 2)
  return sharp(SOURCE)
    .resize(enlarged, enlarged, { fit: 'cover', position: 'attention' })
    .extract({ left: offset, top: offset, width: size, height: size })
}

/** Square center-crop of the photo, resized to `size` (full bleed). */
async function squareIcon(size: number, out: string) {
  await (await zoomedSquare(size))
    .png()
    .toFile(out)
}

/** Rounded-corner square icon (transparent outside the corners). */
async function roundedIcon(size: number, out: string) {
  const radius = Math.round(size * 0.22)
  const photo = await (await zoomedSquare(size))
    .png()
    .toBuffer()
  const mask = Buffer.from(
    `<svg width="${size}" height="${size}"><rect width="${size}" height="${size}" rx="${radius}" ry="${radius}" fill="#fff"/></svg>`
  )
  await sharp(photo)
    .composite([{ input: mask, blend: 'dest-in' }])
    .png()
    .toFile(out)
}

/** Full-bleed maskable icon — the launcher applies its own outer mask. */
async function maskableIcon(size: number, out: string) {
  await (await zoomedSquare(size))
    .png()
    .toFile(out)
}

/**
 * iOS splash: the family photo alone fills the whole screen as a soft
 * blurred backdrop — no other imagery or text on top.
 */
async function splash(width: number, height: number, out: string) {
  await sharp(SOURCE)
    .resize(width, height, { fit: 'cover', position: 'attention' })
    .blur(Math.max(10, Math.round(width / 55)))
    .modulate({ brightness: 1.06, saturation: 1.05 })
    .png()
    .toFile(out)
}

async function main() {
  await ensureDirs()

  // Core icons
  await roundedIcon(192, 'public/icons/icon-192x192.png')
  await roundedIcon(512, 'public/icons/icon-512x512.png')
  await maskableIcon(512, 'public/icons/maskable-512x512.png')
  // Full-bleed squares — iOS/OS surfaces apply their own masking
  await squareIcon(180, 'public/apple-touch-icon.png')
  await squareIcon(96, 'public/icons/notification-icon.png')
  await squareIcon(64, 'public/icons/notification-badge.png')
  await squareIcon(48, 'public/favicon-48.png')

  console.log('✓ Icons generated')

  // iOS splash screens
  const splashSizes: [number, number][] = [
    [2048, 2732], // iPad Pro 12.9"
    [1668, 2388], // iPad Pro 11"
    [1536, 2048], // iPad Air / Mini
    [1284, 2778], // iPhone 12/13/14 Plus
    [1170, 2532], // iPhone 12/13/14
    [1125, 2436], // iPhone X/XS/11 Pro
    [1242, 2688], // iPhone XS Max / 11 Pro Max
    [750, 1334],  // iPhone 8 / SE landscape-classic
  ]
  for (const [w, h] of splashSizes) {
    await splash(w, h, `public/splash-${w}x${h}.png`)
  }
  console.log('✓ Splash screens generated')
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
