import sharp from 'sharp';
import { mkdir, readFile } from 'fs/promises';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const publicDir = join(root, 'public');
const shotsDir = '/tmp/remindrx-shots2';

const markSvg = await readFile(join(publicDir, 'logo-mark.svg'));

/** App icon: full mark on graphite tile */
async function renderMark(size, outPath, { padding = 0 } = {}) {
  const inner = Math.round(size * (1 - padding * 2));
  const offset = Math.round((size - inner) / 2);
  const resized = await sharp(markSvg).resize(inner, inner).png().toBuffer();
  await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: padding > 0 ? { r: 26, g: 26, b: 26, alpha: 1 } : { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{ input: resized, left: offset, top: offset }])
    .png()
    .toFile(outPath);
  console.log('wrote', outPath);
}

/** Favicon: mark only, no extra chrome */
async function renderFavicon() {
  await sharp(markSvg).resize(48, 48).png().toFile(join(publicDir, 'favicon.png'));
  console.log('wrote favicon.png');
}

/** Lockup PNG for shots (light wordmark on dark-friendly transparent) */
async function renderLockupShot() {
  await mkdir(shotsDir, { recursive: true });
  const lockup = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1120" height="256" viewBox="0 0 560 128">
  <rect width="560" height="128" fill="#1A1A1A"/>
  <rect x="0" y="8" width="112" height="112" rx="24" fill="#1A1A1A"/>
  <g transform="translate(8 16) scale(0.1875)">
    <g fill="#FF5B1F">
      <path d="M256 138 L422 258 L256 348 L90 258 Z"/>
      <path d="M170 368H342C360 368 374 382 374 400C374 424 340 442 256 442C172 442 138 424 138 400C138 382 152 368 170 368Z"/>
      <rect x="404" y="258" width="18" height="152" rx="9"/>
    </g>
    <circle cx="413" cy="428" r="26" fill="#FFF3E3"/>
  </g>
  <text x="140" y="82" fill="#F2F2F2" font-family="Sora, ui-sans-serif, system-ui, sans-serif" font-size="52" font-weight="600" letter-spacing="-0.03em">RemindrX</text>
</svg>`;
  await sharp(Buffer.from(lockup)).png().toFile(join(shotsDir, 'logo-lockup.png'));
  console.log('wrote logo-lockup.png');
}

await renderMark(192, join(publicDir, 'icon-192.png'));
await renderMark(512, join(publicDir, 'icon-512.png'));
await renderMark(512, join(publicDir, 'icon-maskable-512.png'), { padding: 0.1 });
await renderMark(180, join(publicDir, 'apple-touch-icon.png'));
await renderFavicon();

await mkdir(shotsDir, { recursive: true });
await renderMark(512, join(shotsDir, 'logo-mark.png'));
await renderLockupShot();

console.log('icons done');
