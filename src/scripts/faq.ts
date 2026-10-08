import { ANSWER_FORMS, plural } from '../lib/plural';

/* ---------- Нормалізація та «стемінг» для української ---------- */

const APOSTROPHES = /['’ʼ`‘]/g;

/** Нижній регістр, без діакритики (phở → pho, й → и, ї → і), без апострофів, ґ → г */
function norm(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(APOSTROPHES, '')
    .replace(/ґ/g, 'г')
    .replace(/đ/g, 'd');
}

/** Те саме, але з картою індексів назад в оригінальний рядок — для підсвітки */
function normWithMap(text: string): { out: string; map: number[] } {
  let out = '';
  const map: number[] = [];
  for (let i = 0; i < text.length; i++) {
    for (const ch of norm(text[i])) {
      out += ch;
      map.push(i);
    }
  }
  return { out, map };
}

const WORD = /[\p{L}\p{N}]+/gu;
const tokenize = (text: string) => norm(text).match(WORD) ?? [];

// Закінчення вже в нормалізованому вигляді (й → и, ї → і). Довші — першими.
const ENDINGS = [
  'ами', 'ями', 'ові', 'еві', 'ого', 'ому', 'ими', 'іми',
  'еи', 'ои', 'ах', 'ях', 'ам', 'ям', 'ом', 'ем', 'ою', 'ею', 'ів', 'іх', 'ии', 'іи',
  'а', 'я', 'у', 'ю', 'і', 'и', 'о', 'е', 'ь',
];

function stem(token: string): string {
  if (token.length <= 3 || /\d/.test(token)) return token;
  for (const ending of ENDINGS) {
    if (token.endsWith(ending) && token.length - ending.length >= 3) {
      return token.slice(0, -ending.length);
    }
  }
  return token;
}

const STOP_WORDS = new Set([
  'як', 'що', 'чи', 'в', 'у', 'на', 'і', 'и', 'та', 'до', 'з', 'із', 'зі', 'по', 'це', 'а',
  'для', 'де', 'про', 'або', 'якии', 'яка', 'яке', 'які', 'мені', 'мене', 'є',
]);

// «Розмовна» транслітерація для запитів кирилицею про латинські назви: телеграм → telegr(am), граб → grab
const LATIN: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', є: 'ye', ж: 'zh', з: 'z', и: 'i', і: 'i',
  к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f',
  х: 'kh', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'shch', ь: '', ю: 'yu', я: 'ya',
};
const toLatin = (s: string) => [...s].map((ch) => LATIN[ch] ?? ch).join('');

/** Для кожного слова запиту — варіанти основи; слово знайдено, якщо збігся хоч один варіант */
function queryStems(query: string): string[][] {
  const tokens = tokenize(query);
  const meaningful = tokens.filter((t) => !STOP_WORDS.has(t) && t.length > 1);
  const stems = [...new Set((meaningful.length ? meaningful : tokens).map(stem))];
  return stems.map((s) => {
    const latin = toLatin(s);
    return latin !== s && latin.length > 2 ? [s, latin] : [s];
  });
}

/* ---------- Індекс з DOM ---------- */

interface Item {
  el: HTMLDetailsElement;
  section: HTMLElement;
  tokens: string[];
}

const toolbar = document.getElementById('toolbar') as HTMLElement;
const input = document.getElementById('q') as HTMLInputElement;
const form = document.getElementById('search-form') as HTMLFormElement;
const clearBtn = document.getElementById('search-clear') as HTMLButtonElement;
const status = document.getElementById('search-status') as HTMLElement;
const empty = document.getElementById('empty') as HTMLElement;
const main = document.getElementById('faq') as HTMLElement;
const toTop = document.getElementById('to-top') as HTMLButtonElement;
const sections = [...document.querySelectorAll<HTMLElement>('section[data-cat]')];
const chipsNav = document.querySelector<HTMLElement>('.chips');

let index: Item[] | undefined;

function buildIndex(): Item[] {
  return [...document.querySelectorAll<HTMLDetailsElement>('details[data-qa]')].map((el) => {
    const title = el.querySelector('.qa-q')?.textContent ?? '';
    const body = el.querySelector('.qa-body .prose')?.textContent ?? '';
    return {
      el,
      section: el.closest<HTMLElement>('section[data-cat]')!,
      tokens: [...new Set([...tokenize(title), ...tokenize(body)])],
    };
  });
}

/**
 * Слово документа підходить під основу запиту, якщо починається з неї і не надто довше:
 * «віз» → «віза», «візу», «візовий», але не «візьміть».
 */
const wordMatches = (word: string, s: string) =>
  word.startsWith(s) && word.length - s.length <= Math.max(3, s.length + 1);
const hits = (tokens: string[], s: string) => tokens.some((t) => wordMatches(t, s));

/* ---------- Пошук ---------- */

const autoOpened = new Set<HTMLDetailsElement>();
let lastQuery = '';

function search(rawQuery: string) {
  const query = rawQuery.trim();
  if (query === lastQuery) return;
  lastQuery = query;
  index ??= buildIndex();

  clearBtn.hidden = !rawQuery;
  document.body.classList.toggle('is-searching', Boolean(query));

  for (const el of autoOpened) el.open = false;
  autoOpened.clear();

  if (!query) {
    for (const item of index) item.el.hidden = false;
    for (const section of sections) section.hidden = false;
    status.hidden = true;
    empty.hidden = true;
    updateNavCounts(null);
    highlight([], []);
    syncUrl('');
    return;
  }

  const stems = queryStems(query);
  const scored = index.map((item) => ({
    item,
    matched: stems.filter((alts) => alts.some((s) => hits(item.tokens, s))).length,
  }));

  // Спершу — всі слова запиту; якщо нічого, то найкращий частковий збіг
  let partial = false;
  let threshold = stems.length;
  if (!scored.some((r) => r.matched === threshold) && stems.length > 1) {
    threshold = Math.max(...scored.map((r) => r.matched));
    partial = threshold > 0;
  }
  const visible = scored.filter((r) => threshold > 0 && r.matched >= threshold).map((r) => r.item);
  const visibleSet = new Set(visible);

  const perSection = new Map<string, number>();
  for (const item of index) {
    const show = visibleSet.has(item);
    item.el.hidden = !show;
    if (show) {
      const id = item.section.dataset.cat!;
      perSection.set(id, (perSection.get(id) ?? 0) + 1);
    }
  }
  for (const section of sections) section.hidden = !perSection.has(section.dataset.cat!);
  updateNavCounts(perSection);

  // Мало результатів — розгортаємо, щоб одразу було видно відповідь
  if (visible.length <= 3) {
    for (const item of visible) {
      if (!item.el.open) {
        item.el.open = true;
        autoOpened.add(item.el);
      }
    }
  }

  const n = visible.length;
  status.hidden = n === 0;
  empty.hidden = n > 0;
  status.innerHTML = partial
    ? `Точних збігів немає — схожі: <strong>${plural(n, ANSWER_FORMS)}</strong>`
    : `Знайдено <strong>${plural(n, ANSWER_FORMS)}</strong>`;

  highlight(visible, stems.flat());
  syncUrl(query);
  scrollToResults();
}

function updateNavCounts(perSection: Map<string, number> | null) {
  for (const link of document.querySelectorAll<HTMLAnchorElement>('[data-nav]')) {
    const id = link.dataset.nav!;
    const count = link.querySelector<HTMLElement>('.chip-count');
    const n = perSection ? (perSection.get(id) ?? 0) : Number(count?.dataset.count);
    if (count) count.textContent = String(n);
    const hide = perSection !== null && n === 0;
    (link.closest('li') ?? link).toggleAttribute('hidden', hide);
  }
}

/* ---------- Підсвітка (CSS Custom Highlight API) ---------- */

function highlight(items: Item[], stems: string[]) {
  if (!('highlights' in CSS)) return;
  if (!stems.length) {
    CSS.highlights.delete('search');
    return;
  }
  const ranges: Range[] = [];
  for (const { el } of items) {
    for (const root of el.querySelectorAll('.qa-q, .qa-body .prose')) {
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        const text = node.nodeValue ?? '';
        const { out, map } = normWithMap(text);
        for (const m of out.matchAll(WORD)) {
          if (!stems.some((s) => wordMatches(m[0], s))) continue;
          const range = new Range();
          range.setStart(node, map[m.index]);
          range.setEnd(node, map[m.index + m[0].length - 1] + 1);
          ranges.push(range);
        }
      }
    }
  }
  CSS.highlights.set('search', new Highlight(...ranges));
}

/* ---------- URL, прокрутка ---------- */

let urlTimer: number | undefined;
function syncUrl(query: string) {
  clearTimeout(urlTimer);
  urlTimer = window.setTimeout(() => {
    const url = new URL(location.href);
    if (query) {
      url.searchParams.set('q', query);
      url.hash = '';
    } else {
      if (!url.searchParams.has('q')) return;
      url.searchParams.delete('q');
    }
    history.replaceState(null, '', url);
  }, 300);
}

function resultsTop(): number {
  return main.getBoundingClientRect().top + scrollY - toolbar.offsetHeight + 4;
}

function scrollToResults() {
  const top = resultsTop();
  if (Math.abs(scrollY - top) > 2) scrollTo({ top, behavior: 'instant' });
}

/* ---------- Події пошуку ---------- */

input.addEventListener('input', () => search(input.value));

form.addEventListener('submit', (e) => {
  e.preventDefault();
  input.blur(); // ховаємо клавіатуру на телефоні
});

clearBtn.addEventListener('click', () => {
  input.value = '';
  search('');
  input.focus();
});

input.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  if (input.value) {
    input.value = '';
    search('');
  } else {
    input.blur();
  }
});

document.addEventListener('keydown', (e) => {
  if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey) return;
  const target = e.target as HTMLElement;
  if (target.closest('input, textarea, select, [contenteditable="true"]')) return;
  e.preventDefault();
  input.focus();
});

empty.addEventListener('click', (e) => {
  const button = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-suggest]');
  if (!button) return;
  input.value = button.dataset.suggest!;
  search(input.value);
});

/* ---------- Якорі: відкриваємо питання з #hash ---------- */

/** initial — відкрили сторінку за посиланням: стрибаємо одразу, без анімації через усю сторінку */
function openFromHash(initial = false) {
  const id = decodeURIComponent(location.hash.slice(1));
  if (!id) return;
  const target = document.getElementById(id);
  if (!(target instanceof HTMLDetailsElement)) return;
  if (target.hidden) {
    input.value = '';
    search('');
  }
  target.open = true;
  const scroll = () => target.scrollIntoView({ block: 'start', behavior: initial ? 'instant' : 'auto' });
  requestAnimationFrame(scroll);
  // Ще раз після анімації розкриття: поки вона йде, сторінка коротша і низ не докручується
  setTimeout(scroll, 320);
}

addEventListener('hashchange', () => openFromHash());

/* ---------- Поділитися ---------- */

main.addEventListener('click', async (e) => {
  const button = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-share]');
  if (!button) return;
  const id = button.dataset.share!;
  const url = new URL(location.href);
  url.search = '';
  url.hash = id;
  history.replaceState(null, '', url);

  if (navigator.share && matchMedia('(pointer: coarse)').matches) {
    try {
      await navigator.share({ title: button.dataset.title, url: url.href });
    } catch {
      /* користувач закрив меню */
    }
    return;
  }
  try {
    await navigator.clipboard.writeText(url.href);
    const label = button.querySelector('span')!;
    label.textContent = 'Посилання скопійовано';
    button.classList.add('is-done');
    setTimeout(() => {
      label.textContent = 'Поділитися';
      button.classList.remove('is-done');
    }, 2000);
  } catch {
    /* немає доступу до буфера — посилання вже в адресному рядку */
  }
});

/* ---------- Липкий тулбар, висота, scrollspy, «нагору» ---------- */

new ResizeObserver(() => {
  document.documentElement.style.setProperty('--toolbar-h', `${toolbar.offsetHeight}px`);
}).observe(toolbar);

const sentinel = document.querySelector('.toolbar-sentinel');
if (sentinel) {
  new IntersectionObserver(([entry]) => {
    toolbar.classList.toggle('is-stuck', !entry.isIntersecting && entry.boundingClientRect.top < 0);
  }).observe(sentinel);
}

let activeId: string | undefined;
function setActive(id: string | undefined) {
  if (id === activeId) return;
  activeId = id;
  for (const link of document.querySelectorAll<HTMLElement>('[data-nav]')) {
    if (link.dataset.nav === id) link.setAttribute('aria-current', 'true');
    else link.removeAttribute('aria-current');
  }
  const chip = id ? chipsNav?.querySelector<HTMLElement>(`[data-nav="${CSS.escape(id)}"]`) : null;
  if (chip && chipsNav) {
    chipsNav.scrollTo({
      left: chip.offsetLeft - (chipsNav.clientWidth - chip.offsetWidth) / 2,
      behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',
    });
  }
}

let ticking = false;
function onScroll() {
  if (ticking) return;
  ticking = true;
  requestAnimationFrame(() => {
    ticking = false;
    const line = toolbar.offsetHeight + 24;
    let current: string | undefined;
    for (const section of sections) {
      if (section.hidden) continue;
      if (section.getBoundingClientRect().top <= line) current = section.dataset.cat;
      else break;
    }
    // Біля самого низу сторінки — підсвічуємо останній розділ
    if (innerHeight + scrollY >= document.documentElement.scrollHeight - 4) {
      current = sections.filter((s) => !s.hidden).at(-1)?.dataset.cat ?? current;
    }
    setActive(current);
    toTop.hidden = scrollY < innerHeight * 1.5;
  });
}

addEventListener('scroll', onScroll, { passive: true });
toTop.addEventListener('click', () => scrollTo({ top: 0 }));

/* ---------- Старт ---------- */

const initialQuery = new URL(location.href).searchParams.get('q');
if (initialQuery) {
  input.value = initialQuery;
  search(initialQuery);
} else {
  openFromHash(true);
}
onScroll();
