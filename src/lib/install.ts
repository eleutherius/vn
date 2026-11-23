/** Картка «Встановити гайд», яка стає на місце маркера <!-- install --> у відповіді */

const MARKER = /<!--\s*install\s*-->/g;

const OFFLINE_ICON =
  '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M8 2v8M4.5 6.5L8 10l3.5-3.5M3 13.5h10" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';

/** Іконка «Поділитися» з iOS — щоб було видно, яку кнопку шукати */
const SHARE_ICON =
  '<svg class="install-share" width="14" height="16" viewBox="0 0 14 16" fill="none" aria-label="«Поділитися»" role="img"><path d="M7 1.5v8.5M4 4.3L7 1.5l3 2.8M4.5 6.5H3a1.5 1.5 0 00-1.5 1.5v5A1.5 1.5 0 003 14.5h8a1.5 1.5 0 001.5-1.5V8A1.5 1.5 0 0011 6.5H9.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';

/**
 * Показуємо одну з підказок — вибирає src/scripts/pwa.ts:
 * кнопку там, де браузер уміє встановлювати сам (Android, Chrome, Edge),
 * інструкцію для iPhone/iPad, загальну — для решти, і «вже встановлено» в самому застосунку.
 */
export function installCard(): string {
  return `<aside class="install-card" data-install aria-label="Гайд без інтернету">
<p class="install-kicker">${OFFLINE_ICON}Гайд без інтернету</p>
<p class="install-title">Встановіть гайд на телефон</p>
<p class="install-text">Він зʼявиться іконкою поруч із Grab і Zalo й відкриватиметься навіть без мережі — коли ще немає SIM чи eSIM не підхопилась.</p>
<button type="button" class="install-btn" data-install-btn hidden>Встановити гайд</button>
<p class="install-how" data-install-how="ios" hidden>Натисніть ${SHARE_ICON} «Поділитися» внизу Safari (або в адресному рядку) і виберіть «На початковий екран» — Add to Home Screen.</p>
<p class="install-how" data-install-how="other">У меню браузера виберіть «Встановити застосунок» або «Додати на головний екран». Якщо такого пункту немає — відкрийте гайд у Chrome чи Safari.</p>
<p class="install-done" data-install-done hidden>✓ Гайд уже встановлено — він працює й без інтернету.</p>
</aside>`;
}

/** Підставляє картку замість маркера */
export function withInstall(html: string): string {
  return html.replace(MARKER, () => installCard());
}
