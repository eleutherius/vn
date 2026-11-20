export interface Promo {
  /** Короткий рядок у шапці: «eSIM Saily: −$5 з кодом» + код */
  short: string;
  /** Підпис над карткою у відповіді */
  kicker: string;
  title: string;
  text: string;
  /** Промокод: кнопка копіює його в буфер */
  code: string;
  url: string;
  cta: string;
  /** Якір питання, куди веде рядок у шапці. Картку з кодом показує маркер <!-- promo --> у markdown */
  moreHref: string;
  note: string;
}

/** Рядок у шапці + картка в місці маркера <!-- promo -->. Щоб прибрати, поставте `undefined`. */
const promo: Promo | undefined = {
  short: 'eSIM Saily: −$5 з кодом',
  kicker: 'Мій вибір · Saily',
  title: 'Інтернет одразу після посадки',
  text: 'З кодом перший пакет Saily дешевший на $5, а Ultra — на $10. Введіть його при оплаті.',
  code: 'OLEKSA1059',
  url: 'https://saily.onelink.me/5Txv/OLEKSA1059',
  cta: 'Встановити Saily',
  moreHref: '#a-yak-shchodo-esim',
  note: 'Реферальне посилання: вам знижка, мені бонус у Saily.',
};

export const site = {
  promo,
  title: 'Вʼєтнам: питання і відповіді',
  description:
    'FAQ для мандрівників до Вʼєтнаму українською: візи, гроші, звʼязок, транспорт, погода, їжа, безпека, етикет, переїзд і міста.',
  eyebrow: 'Довідник для мандрівників',
  heading: 'Вʼєтнам',
  tagline: 'Коротко й по суті про все, що спадає на думку перед поїздкою і вже на місці.',
  searchPlaceholder: 'Пошук: віза, Grab, eSIM…',
  /** Підказки в порожньому стані пошуку */
  suggestions: ['віза', 'Фукуок', 'візаран', 'житло', 'обмін', 'права', 'Grab', 'eSIM', 'сезон дощів', 'фо'],
  /** Посилання «Виправити» біля розділу. Порожній рядок — вимкнути. */
  repoUrl: 'https://github.com/eleutherius/vn',
  repoBranch: 'main',
  disclaimer:
    'Правила вʼїзду, ціни й курси змінюються. Перед поїздкою звіряйтеся з офіційними джерелами: порталом е-віз Вʼєтнаму та сайтом Посольства України у Вʼєтнамі.',
};
