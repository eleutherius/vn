/**
 * Курси валют для калькулятора. Джерело — безкоштовний відкритий API
 * github.com/fawazahmed0/exchange-api: оновлюється щодня, без ключа, з CORS.
 *
 * Під час білду курси підтягуються й вшиваються в сторінку, тож калькулятор
 * працює навіть без мережі. У браузері скрипт оновлює їх тим самим API.
 */

export const RATE_CURRENCIES = ['vnd', 'uah', 'usd', 'eur'] as const;
export type Currency = (typeof RATE_CURRENCIES)[number];

export interface Rates {
  /** Дата курсу з API, YYYY-MM-DD */
  date: string;
  /** Скільки одиниць валюти за 1 USD */
  usd: Record<Currency, number>;
}

/** Основне джерело і дзеркало — той самий набір даних */
export const RATE_URLS = [
  'https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.min.json',
  'https://latest.currency-api.pages.dev/v1/currencies/usd.min.json',
];

/** Якщо під час білду API недоступний. Оновлюйте раз на кілька місяців. */
const FALLBACK: Rates = {
  date: '2026-11-22',
  usd: { usd: 1, vnd: 25788.85, uah: 44.9912, eur: 0.91158 },
};

/** Перевіряє відповідь API і лишає тільки потрібні валюти */
export function pickRates(json: unknown): Rates | undefined {
  const data = json as { date?: unknown; usd?: Record<string, unknown> } | null;
  if (!data || typeof data.date !== 'string' || !data.usd) return;
  const usd = {} as Record<Currency, number>;
  for (const cur of RATE_CURRENCIES) {
    const value = cur === 'usd' ? 1 : Number(data.usd[cur]);
    if (!Number.isFinite(value) || value <= 0) return;
    usd[cur] = value;
  }
  return { date: data.date, usd };
}

async function fetchRates(): Promise<Rates | undefined> {
  for (const url of RATE_URLS) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
      if (!res.ok) continue;
      const rates = pickRates(await res.json());
      if (rates) return rates;
    } catch {
      /* пробуємо дзеркало */
    }
  }
}

let cached: Promise<Rates> | undefined;

/** Курси на момент білду; один запит на весь білд */
export function getRates(): Promise<Rates> {
  cached ??= fetchRates().then((rates) => {
    if (rates) return rates;
    console.warn(`[rates] API недоступний — беремо запасні курси від ${FALLBACK.date}`);
    return FALLBACK;
  });
  return cached;
}
