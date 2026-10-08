import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

// Кожен .md у src/content/faq — це розділ FAQ.
// Файли, що починаються з "_", ігноруються (шаблони, чернетки).
const faq = defineCollection({
  loader: glob({ pattern: '**/[^_]*.md', base: './src/content/faq' }),
  schema: z.object({
    title: z.string().optional(),
    description: z.string().optional(),
    icon: z.string().optional(),
    order: z.number().optional(),
    slug: z.string().optional(),
    updated: z.coerce.date().optional(),
    draft: z.boolean().optional(),
  }),
});

export const collections = { faq };
