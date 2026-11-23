/**
 * Гайд як застосунок (PWA): офлайн-режим і картка «Встановити гайд» (маркер <!-- install -->).
 * Service worker (dist/sw.js) збирається під час білду — у pnpm dev його немає.
 */

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const base = import.meta.env.BASE_URL.replace(/\/?$/, '/');

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  addEventListener('load', () => {
    navigator.serviceWorker.register(`${base}sw.js`, { updateViaCache: 'none' }).catch(() => {
      /* не вийшло — гайд просто працює без офлайну */
    });
  });
}

/** Для аналітики (analytics.ts) */
const emit = (action: 'standalone' | 'install-click' | 'installed') =>
  document.dispatchEvent(new CustomEvent('faq:pwa', { detail: { action } }));

const isStandalone = () =>
  matchMedia('(display-mode: standalone)').matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true;

// iPadOS прикидається Mac, але має сенсорний екран
const isIos = () =>
  /iPhone|iPad|iPod/.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1);

const cards = [...document.querySelectorAll<HTMLElement>('[data-install]')];
let deferredPrompt: BeforeInstallPromptEvent | undefined;

type State = 'button' | 'ios' | 'other' | 'done';

function show(state: State) {
  for (const card of cards) {
    card.querySelector<HTMLElement>('[data-install-btn]')!.hidden = state !== 'button';
    card.querySelector<HTMLElement>('[data-install-done]')!.hidden = state !== 'done';
    for (const how of card.querySelectorAll<HTMLElement>('[data-install-how]')) {
      how.hidden = how.dataset.installHow !== state;
    }
  }
}

if (isStandalone()) {
  show('done');
  emit('standalone');
} else {
  show(isIos() ? 'ios' : 'other');
}

// Chrome, Edge, Samsung Internet: браузер готовий встановити — показуємо свою кнопку
addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e as BeforeInstallPromptEvent;
  show('button');
});

addEventListener('appinstalled', () => {
  deferredPrompt = undefined;
  show('done');
  emit('installed');
});

for (const card of cards) {
  card.querySelector('[data-install-btn]')?.addEventListener('click', async () => {
    if (!deferredPrompt) return;
    emit('install-click');
    const prompt = deferredPrompt;
    deferredPrompt = undefined; // показати діалог можна лише раз
    await prompt.prompt();
    const { outcome } = await prompt.userChoice;
    if (outcome !== 'accepted') show(isIos() ? 'ios' : 'other');
  });
}

export {};
