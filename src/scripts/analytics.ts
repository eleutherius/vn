/**
 * Що читають і шукають — події GoatCounter (без cookies). Назви подій:
 *
 *   read-q-<питання>     відповідь пробула в «зоні читання» ≥ 5 с
 *   read-<розділ>        прочитали хоча б одну відповідь розділу (а не просто бачили його зміст)
 *   search-<запит>       пошуковий запит (після паузи в наборі або Enter)
 *   search-miss-<запит>  запит, на який нічого не знайшлося
 *   link-<якір>          сторінку відкрили одразу з #якорем (referrer — звідки прийшли)
 *   share-<питання>      натиснули «Поділитися»
 *   nav-<розділ>         клік по чипу або розділу в лівій колонці
 *   toc-<питання>        клік по питанню в змісті розділу чи в лівій колонці
 *
 * Кожна подія надсилається не більше одного разу за відкриття сторінки.
 * Якщо GoatCounter заблокований (adblock) — усе тихо нічого не робить.
 */

interface GoatCounterVars {
  path: string;
  title?: string;
  referrer?: string;
  event?: boolean;
}

declare global {
  interface Window {
    goatcounter?: { count?: (vars: GoatCounterVars) => void };
  }
}

const READ_QUESTION_MS = 5000;
const SEARCH_IDLE_MS = 1500;
const MAX_QUERY_LENGTH = 40;

/* ---------- Надсилання з чергою, поки count.js ще вантажиться ---------- */

const sent = new Set<string>();
const pending: GoatCounterVars[] = [];

function flush() {
  const count = window.goatcounter?.count;
  if (!count) return;
  for (const vars of pending.splice(0)) count(vars);
}

function track(path: string, title: string, referrer?: string) {
  if (sent.has(path)) return;
  sent.add(path);
  pending.push({ path, title, event: true, ...(referrer ? { referrer } : {}) });
  flush();
}

document.querySelector('script[data-goatcounter]')?.addEventListener('load', flush);
addEventListener('load', flush);

const isSearching = () => document.body.classList.contains('is-searching');
const textOf = (el: Element | null | undefined) => el?.textContent?.replace(/\s+/g, ' ').trim() ?? '';

/* ---------- Читання: елемент у зоні читання достатньо довго ---------- */

// Зона читання — смуга від 25% до 55% висоти екрана: туди потрапляє те, що зараз читають,
// а не те, що просто промайнуло при прокрутці
const READING_ZONE = '-25% 0px -45% 0px';

function watchReading(elements: HTMLElement[], delay: number, onRead: (el: HTMLElement) => void) {
  const timers = new Map<HTMLElement, number>();
  const inZone = new Set<HTMLElement>();

  const start = (el: HTMLElement) => {
    if (timers.has(el) || document.hidden) return;
    timers.set(
      el,
      window.setTimeout(() => {
        timers.delete(el);
        // Під час пошуку на екрані лише вибрані відповіді — це не читання розділу
        if (!isSearching() && inZone.has(el)) onRead(el);
      }, delay),
    );
  };
  const stop = (el: HTMLElement) => {
    clearTimeout(timers.get(el));
    timers.delete(el);
  };

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        const el = entry.target as HTMLElement;
        if (entry.isIntersecting) {
          inZone.add(el);
          start(el);
        } else {
          inZone.delete(el);
          stop(el);
        }
      }
    },
    { rootMargin: READING_ZONE },
  );
  for (const el of elements) observer.observe(el);

  // Вкладку сховали — час не йде
  document.addEventListener('visibilitychange', () => {
    for (const el of inZone) (document.hidden ? stop : start)(el);
  });
}

watchReading([...document.querySelectorAll<HTMLElement>('article[data-qa]')], READ_QUESTION_MS, (article) => {
  const section = article.closest<HTMLElement>('section[data-cat]');
  if (section) track(`read-${section.id}`, `Читали розділ: ${textOf(section.querySelector('.cat-title'))}`);
  track(`read-q-${article.id}`, `Читали: ${textOf(article.querySelector('.qa-q'))}`);
});

/* ---------- Пошук ---------- */

// faq.ts повідомляє про кожен пошук: { query, results }
let searchTimer: number | undefined;
let lastSearch = { query: '', results: 0 };

function sendSearch() {
  clearTimeout(searchTimer);
  const query = lastSearch.query.toLowerCase().replace(/\s+/g, ' ').trim().slice(0, MAX_QUERY_LENGTH);
  if (query.length < 2) return;
  track(`search-${query}`, `Пошук: «${query}»`);
  if (lastSearch.results === 0) track(`search-miss-${query}`, `Нічого не знайшли: «${query}»`);
}

document.addEventListener('faq:search', (e) => {
  lastSearch = (e as CustomEvent<{ query: string; results: number }>).detail;
  clearTimeout(searchTimer);
  if (lastSearch.query) searchTimer = window.setTimeout(sendSearch, SEARCH_IDLE_MS);
});
document.getElementById('search-form')?.addEventListener('submit', sendSearch);
// Пішли зі сторінки, не дочекавшись паузи, — запит усе одно рахуємо
addEventListener('pagehide', sendSearch);

/* ---------- Відкрили за посиланням з #якорем ---------- */

const initialId = decodeURIComponent(location.hash.slice(1));
const initialTarget = initialId ? document.getElementById(initialId) : null;
if (initialTarget?.matches('[data-qa], section[data-cat]')) {
  const title = textOf(initialTarget.querySelector('.qa-q, .cat-title'));
  track(`link-${initialId}`, `Відкрили за посиланням: ${title}`, document.referrer || undefined);
}

/* ---------- Кліки: поділитися, навігація, зміст ---------- */

document.addEventListener('click', (e) => {
  const el = (e.target as HTMLElement).closest<HTMLElement>('[data-share], [data-nav], [data-qnav], .cat-toc a');
  if (!el) return;
  if (el.dataset.share) {
    track(`share-${el.dataset.share}`, `Поділилися: ${el.dataset.title ?? ''}`);
  } else if (el.dataset.nav) {
    const id = el.dataset.nav;
    track(`nav-${id}`, `Перейшли до розділу: ${textOf(document.getElementById(id)?.querySelector('.cat-title'))}`);
  } else {
    const id = el.dataset.qnav ?? decodeURIComponent(el.getAttribute('href')?.slice(1) ?? '');
    if (id) track(`toc-${id}`, `Відкрили зі змісту: ${textOf(document.getElementById(id)?.querySelector('.qa-q'))}`);
  }
});

export {};
