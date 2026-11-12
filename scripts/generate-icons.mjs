import sharp from 'sharp';
import { mkdir, readFile } from 'fs/promises';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const publicDir = join(root, 'public');
const shotsDir = '/tmp/remindrx-shots';

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

/** Lockup PNG for shots (dark wordmark on transparent) */
async function renderLockupShot() {
  await mkdir(shotsDir, { recursive: true });
  const lockup = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1120" height="256" viewBox="0 0 560 128">
  <rect x="0" y="8" width="112" height="112" rx="24" fill="#1A1A1A"/>
  <g transform="translate(8 16) scale(0.1875)">
    <path fill="#FF5B1F" fill-rule="evenodd" d="M150 130H318C392 130 430 168 430 222C430 270 402 304 348 314L430 420H352L278 326H206V420H150V130ZM206 182V274H310C342 274 368 256 368 222C368 188 342 182 310 182H206Z"/>
    <circle cx="412" cy="412" r="24" fill="#FF5B1F"/>
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
