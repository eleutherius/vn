/**
 * Калькулятор валют (картка на місці <!-- converter -->).
 * Вводите суму в будь-якому рядку — решта перераховується.
 *
 * Курс: «Ринковий» (з відкритого API), готові з site.config.ts або «Свій».
 * Будь-яке число курсу можна підправити — тоді вмикається «Свій», а вибір памʼятається в браузері.
 * Ринкові курси вшиті в сторінку під час білду; коли картка наближається до екрана,
 * скрипт тихо підтягує свіжі й кешує їх у localStorage — тож офлайн теж працює.
 */
import type { RatePreset } from '../site.config';
import {
  FOREIGN,
  NBSP,
  convert,
  formatAmount,
  formatRate,
  fromVnd,
  parseAmount,
  presetVnd,
  rateNote,
  toVnd,
  type Foreign,
  type VndRates,
} from '../lib/converter';
import { RATE_URLS, pickRates, type Currency, type Rates } from '../lib/rates';

const RATES_KEY = 'vn-fx-rates';
const MODE_KEY = 'vn-fx-mode';
const REFRESH_MS = 6 * 60 * 60 * 1000;

/* ---------- Сховище: ринкові курси й вибір читача ---------- */

interface StoredRates {
  rates: Rates;
  checked: number;
}

interface StoredMode {
  /** market | custom | preset:<id> */
  mode: string;
  custom?: VndRates;
}

function load<T>(key: string): T | undefined {
  try {
    return JSON.parse(localStorage.getItem(key) ?? 'null') ?? undefined;
  } catch {
    return undefined; // сховище недоступне або зіпсоване
  }
}

function save(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* приватний режим */
  }
}

function readStoredRates(): StoredRates | undefined {
  const stored = load<StoredRates>(RATES_KEY);
  const rates = pickRates(stored?.rates);
  if (rates && typeof stored?.checked === 'number') return { rates, checked: stored.checked };
}

function validVnd(value: unknown): VndRates | undefined {
  const v = value as Partial<Record<Foreign, unknown>> | null | undefined;
  if (!v) return;
  const out = {} as VndRates;
  for (const cur of FOREIGN) {
    const n = Number(v[cur]);
    if (!Number.isFinite(n) || n <= 0) return;
    out[cur] = n;
  }
  return out;
}

let refreshing: Promise<Rates | undefined> | undefined;

/** Один запит на сторінку, і не частіше ніж раз на 6 годин */
function refreshRates(): Promise<Rates | undefined> {
  const stored = readStoredRates();
  if (stored && Date.now() - stored.checked < REFRESH_MS) return Promise.resolve(stored.rates);
  refreshing ??= (async () => {
    for (const url of RATE_URLS) {
      try {
        const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
        const rates = res.ok ? pickRates(await res.json()) : undefined;
        if (rates) {
          save(RATES_KEY, { rates, checked: Date.now() } satisfies StoredRates);
          return rates;
        }
      } catch {
        /* пробуємо дзеркало */
      }
    }
    return stored?.rates;
  })();
  return refreshing;
}

/* ---------- Поля ---------- */

const SPACE = /\s/;

/** Групує розряди просто під час набору й не збиває курсор: 1000000 → 1 000 000 */
function groupWhileTyping(input: HTMLInputElement) {
  const raw = input.value;
  const m = raw.match(/^([\d\s]*)([.,]\d*)?$/);
  if (!m) return; // «50k», «1.5M» — не чіпаємо, відформатуємо при виході з поля
  const digits = m[1].replace(/\D/g, '').replace(/^0+(?=\d)/, '');
  const out = digits.replace(/\B(?=(\d{3})+(?!\d))/g, NBSP) + (m[2] ?? '');
  if (out === raw) return;

  const caret = input.selectionStart ?? raw.length;
  const before = [...raw.slice(0, caret)].filter((ch) => !SPACE.test(ch)).length;
  input.value = out;
  let pos = 0;
  for (let seen = 0; pos < out.length && seen < before; pos++) if (!SPACE.test(out[pos])) seen++;
  input.setSelectionRange(pos, pos);
}

/** Спільна поведінка числових полів: виділити все при фокусі, Enter ховає клавіатуру */
function numericField(input: HTMLInputElement, onBlur: () => void) {
  // Тапнули й одразу набираєте нове число, без стирання
  input.addEventListener('focus', () => requestAnimationFrame(() => input.select()));
  input.addEventListener('blur', onBlur);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') input.blur();
  });
}

/** Для аналітики (analytics.ts) */
function emit(action: string, label?: string) {
  document.dispatchEvent(new CustomEvent('faq:converter', { detail: { action, label } }));
}

/* ---------- Картка ---------- */

function setup(card: HTMLElement) {
  let market = pickRates(JSON.parse(card.dataset.rates ?? 'null'));
  if (!market) return;
  const presets: RatePreset[] = JSON.parse(card.dataset.presets ?? '[]');

  const amountInputs = new Map<Currency, HTMLInputElement>();
  for (const input of card.querySelectorAll<HTMLInputElement>('input[data-cur]')) {
    amountInputs.set(input.dataset.cur as Currency, input);
  }
  const rateInputs = new Map<Foreign, HTMLInputElement>();
  for (const input of card.querySelectorAll<HTMLInputElement>('input[data-rate]')) {
    rateInputs.set(input.dataset.rate as Foreign, input);
  }
  const modeButtons = [...card.querySelectorAll<HTMLButtonElement>('[data-fx-mode]')];
  const noteEl = card.querySelector<HTMLElement>('[data-fx-note]');

  // Звідки курс: ринковий, готовий із конфігу чи свій — і що читач обрав минулого разу
  const presetOf = (mode: string) => presets.find((p) => `preset:${p.id}` === mode);
  const saved = load<StoredMode>(MODE_KEY);
  let custom = validVnd(saved?.custom);
  let mode = 'market';
  if (saved && modeButtons.some((b) => b.dataset.fxMode === saved.mode) && (saved.mode !== 'custom' || custom)) {
    mode = saved.mode;
  }

  const activeVnd = (): VndRates => {
    if (mode === 'custom' && custom) return custom;
    const preset = presetOf(mode);
    return preset ? presetVnd(preset, market!) : toVnd(market!);
  };
  let rates = fromVnd(activeVnd(), market.date);

  // Від чого рахуємо суми: валюта, яку редагували останньою
  let source: { cur: Currency; amount: number | null } = {
    cur: 'vnd',
    amount: parseAmount(amountInputs.get('vnd')?.value ?? '', 'vnd'),
  };

  const renderAmounts = () => {
    for (const [cur, input] of amountInputs) {
      if (cur === source.cur) continue;
      input.value = source.amount === null ? '' : formatAmount(convert(source.amount, source.cur, cur, rates), cur);
      input.removeAttribute('aria-invalid');
    }
  };

  /** Перемальовує курс, кнопки й підпис; skip — поле курсу, яке зараз редагують */
  const renderRates = (skip?: HTMLInputElement) => {
    const vnd = activeVnd();
    rates = fromVnd(vnd, market!.date);
    for (const [cur, input] of rateInputs) {
      if (input === skip) continue;
      input.value = formatRate(vnd[cur]);
      input.removeAttribute('aria-invalid');
    }
    for (const button of modeButtons) button.setAttribute('aria-pressed', String(button.dataset.fxMode === mode));
    if (noteEl) {
      const state = mode === 'custom' ? 'custom' : (presetOf(mode) ?? 'market');
      noteEl.textContent = rateNote(state, market!, presets.length > 0);
    }
    renderAmounts();
  };

  const saveMode = () => save(MODE_KEY, { mode, custom } satisfies StoredMode);

  /* Суми */
  for (const [cur, input] of amountInputs) {
    input.addEventListener('input', () => {
      groupWhileTyping(input);
      source = { cur, amount: parseAmount(input.value, cur) };
      input.toggleAttribute('aria-invalid', source.amount === null && input.value.trim() !== '');
      renderAmounts();
      emit('use');
    });
    numericField(input, () => {
      if (source.cur === cur && source.amount !== null) input.value = formatAmount(source.amount, cur);
    });
  }

  /* Курс: правка будь-якого числа вмикає «Свій», решта береться з того, що було вибрано */
  for (const [cur, input] of rateInputs) {
    input.addEventListener('input', () => {
      groupWhileTyping(input);
      const value = parseAmount(input.value, 'vnd');
      const ok = value !== null && value > 0;
      input.toggleAttribute('aria-invalid', !ok && input.value.trim() !== '');
      if (!ok) return;
      custom = { ...activeVnd(), [cur]: value };
      mode = 'custom';
      renderRates(input);
      saveMode();
      emit('custom');
    });
    numericField(input, () => {
      input.value = formatRate(activeVnd()[cur]);
      input.removeAttribute('aria-invalid');
    });
  }

  card.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;

    const modeButton = target.closest<HTMLButtonElement>('[data-fx-mode]');
    if (modeButton) {
      const next = modeButton.dataset.fxMode!;
      // «Свій» уперше — стартуємо з курсу, який зараз на екрані
      if (next === 'custom' && !custom) custom = activeVnd();
      mode = next;
      renderRates();
      saveMode();
      if (next === 'custom') rateInputs.get('usd')?.focus();
      const preset = presetOf(next);
      emit(next === 'custom' ? 'custom' : `rate-${preset?.id ?? next}`, preset?.label ?? modeButton.textContent ?? '');
      return;
    }

    const amountButton = target.closest<HTMLButtonElement>('[data-fx-preset]');
    const vnd = amountInputs.get('vnd');
    if (amountButton && vnd) {
      source = { cur: 'vnd', amount: Number(amountButton.dataset.fxPreset) };
      vnd.value = formatAmount(source.amount!, 'vnd');
      vnd.removeAttribute('aria-invalid');
      renderAmounts();
      emit('use');
    }
  });

  /* Ринковий курс: закешований свіжіший — одразу, з мережі — коли картка от-от на екрані */
  const applyMarket = (next: Rates | undefined) => {
    if (!next || next.date < market!.date) return;
    market = next;
    const active = document.activeElement;
    renderRates(active instanceof HTMLInputElement ? active : undefined);
  };

  applyMarket(readStoredRates()?.rates);
  renderRates();

  const refresh = () => refreshRates().then(applyMarket);
  const observer = new IntersectionObserver(
    (entries) => {
      if (!entries.some((e) => e.isIntersecting)) return;
      observer.disconnect();
      refresh();
    },
    { rootMargin: '600px 0px' },
  );
  observer.observe(card);
  card.addEventListener('focusin', refresh, { once: true });
}

for (const card of document.querySelectorAll<HTMLElement>('[data-fx]')) setup(card);

export {};
