import type { APIRoute } from 'astro';
import { site } from '../site.config';

/**
 * Маніфест PWA: назва й іконка, коли гайд встановлюють на телефон.
 * Шляхи відносні — рахуються від /vn/manifest.webmanifest, тож працюють і з base.
 * Іконки — public/icon-*.png і apple-touch-icon.png (з public/favicon.svg і src/pwa/*.svg).
 */
export const GET: APIRoute = () =>
  new Response(
    JSON.stringify(
      {
        id: './',
        name: site.title,
        short_name: site.heading,
        description: site.description,
        lang: 'uk',
        dir: 'ltr',
        start_url: './',
        scope: './',
        display: 'standalone',
        background_color: '#fcfbf8',
        theme_color: '#a11f19',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      null,
      2,
    ),
    { headers: { 'Content-Type': 'application/manifest+json' } },
  );
