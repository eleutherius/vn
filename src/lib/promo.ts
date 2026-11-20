import type { Promo } from '../site.config';

const PROMO_MARKER = /<!--\s*promo\s*-->/g;

const escape = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const SIGNAL_ICON =
  '<svg width="16" height="16" viewBox="0 0 18 18" fill="none" aria-hidden="true"><path d="M3 14v-2M7 14V9.5M11 14V6.5M15 14V3.5" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>';

const COPY_ICON =
  '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true"><rect x="5" y="5" width="8.5" height="8.5" rx="2" stroke="currentColor" stroke-width="1.5"/><path d="M10.5 3.2A1.7 1.7 0 008.8 2.5H4.2A1.7 1.7 0 002.5 4.2v4.6a1.7 1.7 0 00.7 1.4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>';

/** Картка з промокодом, яка стає на місце маркера <!-- promo --> у відповіді */
export function promoCard(promo: Promo): string {
  return `<aside class="promo-card" aria-label="${escape(promo.kicker)}">
<p class="promo-kicker">${SIGNAL_ICON}${escape(promo.kicker)}</p>
<p class="promo-title">${escape(promo.title)}</p>
<p class="promo-text">${escape(promo.text)}</p>
<div class="promo-actions">
<button type="button" class="promo-code" data-copy="${escape(promo.code)}" data-goatcounter-click="promo-copy-code" data-goatcounter-title="Скопіювали промокод"><span class="promo-code-value">${escape(promo.code)}</span><span class="promo-code-hint">${COPY_ICON}<span aria-live="polite">копіювати</span></span></button>
<a class="promo-cta" href="${escape(promo.url)}" target="_blank" rel="noopener noreferrer sponsored" data-goatcounter-click="promo-saily" data-goatcounter-title="Картка Saily">${escape(promo.cta)} <span aria-hidden="true">↗</span></a>
</div>
<p class="promo-note">${escape(promo.note)}</p>
</aside>`;
}

/** Підставляє картку замість маркера; якщо промо вимкнене — просто прибирає маркер */
export function withPromo(html: string, promo: Promo | undefined): string {
  if (!PROMO_MARKER.test(html)) return html;
  PROMO_MARKER.lastIndex = 0;
  return html.replace(PROMO_MARKER, promo ? promoCard(promo) : '');
}
