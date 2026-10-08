import { getCollection } from 'astro:content';
import { Marked } from 'marked';
import { slugify } from './slug';

export interface FaqQuestion {
  id: string;
  /** HTML заголовка питання (інлайн-markdown: **жирний**, `код`) */
  titleHtml: string;
  /** Чистий текст питання — для JSON-LD і поділитися */
  title: string;
  html: string;
  text: string;
}

export interface FaqCategory {
  id: string;
  title: string;
  description?: string;
  icon: string;
  order: number;
  updated?: Date;
  introHtml?: string;
  filePath?: string;
  questions: FaqQuestion[];
}

const marked = new Marked({ gfm: true });

const CALLOUT = /<blockquote>\s*<p>\[!(NOTE|TIP|WARNING|IMPORTANT|CAUTION)\]\s*/gi;

function renderBlock(md: string): string {
  return (marked.parse(md, { async: false }) as string)
    .replace(/<a href="(https?:\/\/[^"]+)"/g, '<a href="$1" target="_blank" rel="noopener noreferrer"')
    .replace(CALLOUT, (_, kind: string) => `<blockquote class="callout" data-kind="${kind.toLowerCase()}"><p>`)
    .replace(/<p>\s*<\/p>/g, '')
    .replace(/<table>/g, '<div class="table-wrap"><table>')
    .replace(/<\/table>/g, '</table></div>');
}

function renderInline(md: string): string {
  return marked.parseInline(md, { async: false }) as string;
}

export function htmlToText(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

interface RawQuestion {
  heading: string;
  customId?: string;
  lines: string[];
}

/**
 * Розбирає тіло markdown-файлу:
 *   # Заголовок        — (необовʼязково) назва розділу, якщо немає title у frontmatter
 *   текст              — вступ до розділу
 *   ## Питання {#id}   — кожен H2 — окреме питання, {#id} — свій якір (необовʼязково)
 *   текст              — відповідь, до наступного H2
 * Рядки всередині ``` / ~~~ блоків не вважаються заголовками.
 */
export function splitMarkdown(body: string) {
  const lines = body.replace(/\r\n?/g, '\n').split('\n');
  const intro: string[] = [];
  const questions: RawQuestion[] = [];
  let h1: string | undefined;
  let current: RawQuestion | undefined;
  let fence: string | undefined;

  for (const line of lines) {
    const fenceMatch = line.match(/^\s{0,3}(`{3,}|~{3,})/);
    if (fenceMatch) {
      const marker = fenceMatch[1][0];
      if (!fence) fence = marker;
      else if (marker === fence) fence = undefined;
    } else if (!fence) {
      const h1Match = line.match(/^#\s+(.+?)\s*#*\s*$/);
      if (h1Match && !h1 && !current && intro.every((l) => !l.trim())) {
        h1 = h1Match[1];
        continue;
      }
      const h2Match = line.match(/^##\s+(.+?)\s*#*\s*$/);
      if (h2Match) {
        const idMatch = h2Match[1].match(/^(.*?)\s*\{#([\w-]+)\}$/);
        current = {
          heading: idMatch ? idMatch[1] : h2Match[1],
          customId: idMatch?.[2],
          lines: [],
        };
        questions.push(current);
        continue;
      }
    }
    (current ? current.lines : intro).push(line);
  }

  return { h1, intro: intro.join('\n').trim(), questions };
}

function prettifyFileName(id: string): string {
  const name = id.replace(/^\d+[-_]/, '').replace(/[-_]+/g, ' ');
  return name.charAt(0).toUpperCase() + name.slice(1);
}

export async function getFaq(): Promise<FaqCategory[]> {
  const entries = await getCollection('faq', ({ data }) => !data.draft);
  const usedIds = new Set<string>();
  const uniqueId = (base: string) => {
    let id = base || 'q';
    for (let n = 2; usedIds.has(id); n++) id = `${base}-${n}`;
    usedIds.add(id);
    return id;
  };

  // Порядок: order з frontmatter, далі — за іменем файлу (01-…, 02-…)
  const fileName = (e: (typeof entries)[number]) => e.filePath?.split('/').pop() ?? e.id;
  const sorted = entries.sort(
    (a, b) =>
      (a.data.order ?? Number.MAX_SAFE_INTEGER) - (b.data.order ?? Number.MAX_SAFE_INTEGER) ||
      fileName(a).localeCompare(fileName(b), 'uk', { numeric: true }),
  );

  return sorted.map((entry, index) => {
    const { h1, intro, questions } = splitMarkdown(entry.body ?? '');
    const id = uniqueId(entry.data.slug ?? slugify(fileName(entry).replace(/\.md$/, '').replace(/^\d+[-_]/, '')));

    return {
      id,
      title: entry.data.title ?? h1 ?? prettifyFileName(fileName(entry).replace(/\.md$/, '')),
      description: entry.data.description,
      icon: entry.data.icon ?? '📌',
      order: entry.data.order ?? index,
      updated: entry.data.updated,
      introHtml: intro ? renderBlock(intro) : undefined,
      filePath: entry.filePath,
      questions: questions.map((q) => {
        const html = renderBlock(q.lines.join('\n').trim());
        const titleHtml = renderInline(q.heading);
        return {
          id: uniqueId(q.customId ?? slugify(htmlToText(titleHtml))),
          title: htmlToText(titleHtml),
          titleHtml,
          html,
          text: htmlToText(html),
        };
      }),
    };
  });
}
