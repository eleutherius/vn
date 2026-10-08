// Транслітерація за постановою КМУ №55 (2010), щоб якорі були латиницею:
// #yak-oformyty-e-vizu замість #%D1%8F%D0%BA-...
const MAP: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'h', ґ: 'g', д: 'd', е: 'e', є: 'ie', ж: 'zh', з: 'z',
  и: 'y', і: 'i', ї: 'i', й: 'i', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p',
  р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'kh', ц: 'ts', ч: 'ch', ш: 'sh',
  щ: 'shch', ь: '', ю: 'iu', я: 'ia', đ: 'd',
};
const INITIAL: Record<string, string> = { є: 'ye', ї: 'yi', й: 'y', ю: 'yu', я: 'ya' };
const APOSTROPHES = /['’ʼ`‘]/g;

export function translit(input: string): string {
  const text = input.toLowerCase().replace(APOSTROPHES, '');
  let out = '';
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const atWordStart = i === 0 || !/\p{L}/u.test(text[i - 1]);
    out += (atWordStart && INITIAL[ch]) || (ch in MAP ? MAP[ch] : ch);
  }
  return out;
}

export function slugify(input: string, maxLength = 60): string {
  const slug = translit(input)
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  if (slug.length <= maxLength) return slug;
  const cut = slug.slice(0, maxLength);
  return cut.slice(0, cut.lastIndexOf('-') > 20 ? cut.lastIndexOf('-') : maxLength);
}
