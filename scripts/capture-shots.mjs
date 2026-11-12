import { chromium } from 'playwright';
import { mkdir } from 'fs/promises';

const out = '/tmp/remindrx-shots';
await mkdir(out, { recursive: true });
const base = 'http://127.0.0.1:5173';

const viewports = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'mobile', width: 390, height: 844 },
];

const publicPages = [
  { path: '/', slug: 'landing' },
  { path: '/login', slug: 'login' },
];

const previewViews = ['dashboard', 'attendance', 'timetable', 'timeline'];

const browser = await chromium.launch();

async function shot(page, file) {
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${out}/${file}`, fullPage: true });
  console.log('saved', file);
}

for (const vp of viewports) {
  const context = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    colorScheme: 'dark',
  });
  const page = await context.newPage();

  for (const p of publicPages) {
    await page.goto(`${base}${p.path}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(900);
    if (p.slug === 'login') {
      await shot(page, `${p.slug}-signin-${vp.name}.png`);
      const toggle = page.getByRole('button', { name: /Need an account/i });
      if (await toggle.count()) {
        await toggle.click();
        await page.waitForTimeout(500);
        await shot(page, `signup-${vp.name}.png`);
      }
    } else {
      await shot(page, `${p.slug}-${vp.name}.png`);
    }
  }

  await page.goto(`${base}/dev/ui-preview`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(900);
  for (const view of previewViews) {
    const btn = page.getByRole('button', { name: new RegExp(`^${view}$`, 'i') });
    if (await btn.count()) {
      await btn.click();
      await page.waitForTimeout(500);
      await shot(page, `preview-${view}-${vp.name}.png`);
    }
  }

  await context.close();
}

await browser.close();
console.log('done');
