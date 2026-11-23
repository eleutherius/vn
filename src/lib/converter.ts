import type { RatePreset } from '../site.config';
import { formatDate } from './plural';
import { RATE_CURRENCIES, type Currency, type Rates } from './rates';

/* ---------- Спільне для білду й браузера: валюти, перерахунок, формат ---------- */

export const CURRENCIES: Record<
  Currency,
  { symbol: string; code: string; name: string; /** «за 1 …» */ per: string; decimals: number }
> = {
  vnd: { symbol: '₫', code: 'VND', name: 'донг', per: 'донг', decimals: 0 },
  uah: { symbol: '₴', code: 'UAH', name: 'гривня', per: 'гривню', decimals: 2 },
  usd: { symbol: '$', code: 'USD', name: 'долар', per: 'долар', decimals: 2 },
  eur: { symbol: '€', code: 'EUR', name: 'євро', per: 'євро', decimals: 2 },
};

/** Валюти, курс яких показуємо в донгах — так його пишуть в обмінниках */
export const FOREIGN = ['usd', 'eur', 'uah'] as const;
export type Foreign = (typeof FOREIGN)[number];
/** Скільки донгів дають за 1 $, € і ₴ */
export type VndRates = Record<Foreign, number>;

/** Швидкі суми в донгах — на телефоні в цифровій клавіатурі немає «k» */
export const VND_PRESETS: [number, string][] = [
  [50_000, '50k'],
  [100_000, '100k'],
  [200_000, '200k'],
  [500_000, '500k'],
  [1_000_000, '1M'],
];

/** Сума, з якою калькулятор відкривається */
export const DEFAULT_VND = 100_000;

/** Нерозривний пробіл: ним Intl групує розряди в uk-UA */
export const NBSP = String.fromCharCode(0xa0);

export const convert = (amount: number, from: Currency, to: Currency, rates: Rates) =>
  (amount / rates.usd[from]) * rates.usd[to];

/** Курси до USD → скільки донгів за 1 $, € і ₴ */
export function toVnd(rates: Rates): VndRates {
  const { usd } = rates;
  return { usd: usd.vnd, eur: usd.vnd / usd.eur, uah: usd.vnd / usd.uah };
}

/** Навпаки: з курсів у донгах — курси до USD для перерахунку */
export function fromVnd(vnd: VndRates, date: string): Rates {
  return { date, usd: { usd: 1, vnd: vnd.usd, eur: vnd.usd / vnd.eur, uah: vnd.usd / vnd.uah } };
}

/** Готовий курс із конфігу: свої числа, решта — ринковий зі зсувом percent */
export function presetVnd(preset: RatePreset, market: Rates): VndRates {
  const base = toVnd(market);
  const k = 1 + (preset.percent ?? 0) / 100;
  return {
    usd: preset.vnd?.usd ?? base.usd * k,
    eur: preset.vnd?.eur ?? base.eur * k,
    uah: preset.vnd?.uah ?? base.uah * k,
  };
}

const formatters = new Map<number, Intl.NumberFormat>();
const formatter = (fraction: number) => {
  let f = formatters.get(fraction);
  if (!f) {
    f = new Intl.NumberFormat('uk-UA', { minimumFractionDigits: fraction, maximumFractionDigits: fraction });
    formatters.set(fraction, f);
  }
  return f;
};

/** 100000 → «100 000»; 174.5 → «174,50»; 100 → «100» (копійки, лише якщо вони є) */
export function formatAmount(value: number, cur: Currency): string {
  const { decimals } = CURRENCIES[cur];
  const factor = 10 ** decimals;
  const rounded = Math.round(value * factor) / factor;
  return formatter(Number.isInteger(rounded) ? 0 : decimals).format(rounded);
}

/** Курс у донгах: 25788.8 → «25 789», а за гривню з десятими: 573.2 → «573,2» */
export function formatRate(value: number): string {
  if (value >= 1000) return formatter(0).format(Math.round(value));
  const rounded = Math.round(value * 10) / 10;
  return formatter(Number.isInteger(rounded) ? 0 : 1).format(rounded);
}

// \s у JS ловить і нерозривні пробіли, якими Intl групує розряди
const SPACES = /[\s_'’]/g;
const SYMBOLS = /[₫$€₴]|vnd|uah|usd|eur|грн/g;
const MULTIPLIERS: Record<string, number> = {
  k: 1e3, к: 1e3, тис: 1e3, тыс: 1e3,
  m: 1e6, м: 1e6, млн: 1e6, tr: 1e6, mil: 1e6,
};

/**
 * Розбирає те, що ввели: «100 000», «100.000», «1,5», «50k», «1.5M», «5tr».
 * Крапка чи кома з рівно трьома цифрами після неї в донгах — це тисячі (так пишуть у Вʼєтнамі).
 * Порожньо або не число — null.
 */
export function parseAmount(raw: string, cur: Currency): number | null {
  const s = raw.toLowerCase().replace(SPACES, '').replace(SYMBOLS, '');
  const m = s.match(/^(\d[\d.,]*|[.,]\d+)([^\d.,]*\.?)$/);
  if (!m) return null;
  let [, num, suffix] = m;
  suffix = suffix.replace(/\.$/, '');
  const multiplier = suffix ? MULTIPLIERS[suffix] : 1;
  if (!multiplier) return null;

  const seps = num.match(/[.,]/g) ?? [];
  if (new Set(seps).size > 1) {
    // І крапка, і кома: остання — десяткова, решта — тисячі
    const last = Math.max(num.lastIndexOf('.'), num.lastIndexOf(','));
    num = num.slice(0, last).replace(/[.,]/g, '') + '.' + num.slice(last + 1);
  } else if (seps.length > 1) {
    num = num.replace(/[.,]/g, ''); // 1.000.000
  } else if (seps.length === 1) {
    const thousands = CURRENCIES[cur].decimals === 0 && !suffix && /[.,]\d{3}$/.test(num);
    num = thousands ? num.replace(/[.,]/, '') : num.replace(',', '.');
  }

  const value = Number(num) * multiplier;
  return Number.isFinite(value) && value < 1e15 ? value : null;
}

/** «2026-11-22» → «22 листопада 2026» (дата локальна, без зсуву поясу) */
export function rateDate(rates: Rates): string {
  const [y, mo, d] = rates.date.split('-').map(Number);
  return formatDate(new Date(y, mo - 1, d));
}

/** Підпис під курсом: звідки він і що з ним робити */
export function rateNote(state: 'market' | 'custom' | RatePreset, market: Rates, hasPresets: boolean): string {
  if (state === 'custom') return 'Свій курс — зберігається лише в цьому браузері. Щоб повернутися, натисніть «Ринковий».';
  if (state === 'market') {
    const hint = hasPresets ? 'виберіть готовий або впишіть свій' : 'впишіть свій, якщо знаєте';
    return `Ринковий курс на ${rateDate(market)}, оновлюється сам. У банках і ювелірках він трохи інший — ${hint}.`;
  }
  return state.note ?? `Курс «${state.label}» з гайду. Його можна підправити під себе.`;
}

/* ---------- Картка на місці маркера <!-- converter --> ---------- */

const MARKER = /<!--\s*converter\s*-->/g;

const escape = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const SWAP_ICON =
  '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M2.5 5.5h10M10 3l2.5 2.5L10 8M13.5 10.5h-10M6 8l-2.5 2.5L6 13" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';

const INPUT_ATTRS =
  'type="text" inputmode="decimal" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" enterkeyhint="done"';

export function converterCard(rates: Rates, presets: RatePreset[] = [], n = 1): string {
  const rows = RATE_CURRENCIES.map((cur) => {
    const { symbol, code, name } = CURRENCIES[cur];
    const id = `fx${n}-${cur}`;
    const value = formatAmount(convert(DEFAULT_VND, 'vnd', cur, rates), cur);
    return `<div class="fx-row">
<label class="fx-cur" for="${id}"><span class="fx-sym" aria-hidden="true">${symbol}</span> <span class="fx-label"><span class="fx-code">${code}</span> <span class="fx-name">${name}</span></span></label>
<input class="fx-input" id="${id}" data-cur="${cur}" ${INPUT_ATTRS} value="${value}">
</div>`;
  }).join('\n');

  const amounts = VND_PRESETS.map(
    ([amount, label]) => `<button type="button" class="fx-preset" data-fx-preset="${amount}">${label}</button>`,
  ).join(' ');

  const modes: [string, string][] = [
    ['market', 'Ринковий'],
    ...presets.map((p): [string, string] => [`preset:${p.id}`, p.label]),
    ['custom', 'Свій'],
  ];
  const modeButtons = modes
    .map(
      ([mode, label], i) =>
        `<button type="button" class="fx-mode" data-fx-mode="${escape(mode)}" aria-pressed="${i === 0}">${escape(label)}</button>`,
    )
    .join(' ');

  const vnd = toVnd(rates);
  const rateCells = FOREIGN.map((cur) => {
    const { symbol, per } = CURRENCIES[cur];
    return `<label class="fx-rate-cell"><span class="fx-rate-sym" aria-hidden="true">${symbol}</span> <span class="sr-only">Донгів за 1 ${per}</span><input class="fx-rate-input" data-rate="${cur}" ${INPUT_ATTRS} value="${formatRate(vnd[cur])}"></label>`;
  }).join(' ');

  return `<aside class="fx-card" data-fx data-rates="${escape(JSON.stringify(rates))}" data-presets="${escape(JSON.stringify(presets))}" aria-label="Калькулятор валют">
<p class="fx-kicker">${SWAP_ICON}Калькулятор валют</p>
<div class="fx-rows">
${rows}
</div>
<div class="fx-presets" role="group" aria-label="Швидкі суми в донгах"><span class="fx-presets-label" aria-hidden="true">₫</span> ${amounts}</div>
<div class="fx-rates" role="group" aria-labelledby="fx${n}-rates">
<div class="fx-rates-head"><p class="fx-rates-title" id="fx${n}-rates">Курс, ₫ за 1</p> <div class="fx-modes">${modeButtons}</div></div>
<div class="fx-rate-grid">${rateCells}</div>
<p class="fx-note" data-fx-note>${rateNote('market', rates, presets.length > 0)}</p>
</div>
</aside>`;
}

/** Підставляє калькулятор замість маркера */
export function withConverter(html: string, rates: Rates, presets: RatePreset[] = []): string {
  let n = 0;
  return html.replace(MARKER, () => converterCard(rates, presets, ++n));
}
