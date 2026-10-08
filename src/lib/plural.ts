const rules = new Intl.PluralRules('uk');

/** plural(5, ['відповідь', 'відповіді', 'відповідей']) → "5 відповідей" */
export function plural(n: number, [one, few, many]: [string, string, string]): string {
  const form = rules.select(n);
  const word = form === 'one' ? one : form === 'few' ? few : many;
  return `${n} ${word}`;
}

export const ANSWER_FORMS: [string, string, string] = ['відповідь', 'відповіді', 'відповідей'];
export const SECTION_FORMS: [string, string, string] = ['розділ', 'розділи', 'розділів'];

export function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('uk-UA', { day: 'numeric', month: 'long', year: 'numeric' })
    .format(date)
    .replace(/\s*р\.$/, '');
}
