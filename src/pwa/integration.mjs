import { createHash } from 'node:crypto';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const TEMPLATE = new URL('./sw.js', import.meta.url);

/** Усі файли в теці, шляхи відносно root через «/» */
async function walk(root, dir = root) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await walk(root, full)));
    else out.push(path.relative(root, full).split(path.sep).join('/'));
  }
  return out;
}

/**
 * Після білду кладе в dist/sw.js service worker зі списком усіх файлів сайту.
 * Версія — хеш їхнього вмісту: змінився хоч один файл — браузери оновлять кеш.
 * У pnpm dev service worker не потрібен і не реєструється.
 * @returns {import('astro').AstroIntegration}
 */
export default function pwa() {
  return {
    name: 'vn-pwa',
    hooks: {
      'astro:build:done': async ({ dir, logger }) => {
        const root = fileURLToPath(dir);
        const files = (await walk(root)).filter((f) => f !== 'sw.js').sort();
        const template = await readFile(TEMPLATE, 'utf8');
        const hash = createHash('sha256').update(template);
        for (const file of files) hash.update(file).update(await readFile(path.join(root, file)));
        const version = hash.digest('hex').slice(0, 12);
        // index.html — це сама сторінка гайду, кешуємо її під адресою /vn/
        const precache = files.map((f) => (f === 'index.html' ? './' : f));
        await writeFile(
          path.join(root, 'sw.js'),
          `const VERSION = '${version}';\nconst PRECACHE = ${JSON.stringify(precache, null, 2)};\n\n${template}`,
        );
        logger.info(`sw.js: версія ${version}, файлів в офлайн-кеші: ${precache.length}`);
      },
    },
  };
}
