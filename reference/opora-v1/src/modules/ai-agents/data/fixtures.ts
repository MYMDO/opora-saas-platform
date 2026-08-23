export interface AgentFixture {
  readonly id: string;
  readonly name: string;
  readonly role: string;
  readonly resolvedToday: number;
  readonly resolvedTotal: number;
  readonly avgTime: string;
  readonly csat: number;
  readonly desc: string;
}

export const AGENTS: ReadonlyArray<AgentFixture> = [
  {
    id: 'solomiya',
    name: 'Соломія',
    role: 'HR-онбординг',
    resolvedToday: 34,
    resolvedTotal: 1284,
    avgTime: '2х 40с',
    csat: 4.8,
    desc: 'Веде первинний онбординг нових співробітників — документи, бронювання, адаптаційний чек-лист.',
  },
  {
    id: 'taras',
    name: 'Тарас',
    role: 'Кваліфікація лідів',
    resolvedToday: 58,
    resolvedTotal: 2931,
    avgTime: '1х 15с',
    csat: 4.6,
    desc: 'Обробляє вхідні заявки, кваліфікує ліди за бюджетом і термінами, передає гарячі угоди менеджеру.',
  },
  {
    id: 'hanna',
    name: 'Ганна',
    role: 'Підтримка клієнтів',
    resolvedToday: 155,
    resolvedTotal: 18_420,
    avgTime: '0х 52с',
    csat: 4.9,
    desc: 'Закриває типові звернення підтримки без ескалації на людину, працює 24/7.',
  },
];

export const CANNED: Record<string, ReadonlyArray<string>> = {
  solomiya: [
    'Вітаю! Я Соломія, допоможу з онбордингом. На яку дату виходить новий співробітник?',
    'Прийнято. Документи для оформлення вже підготовлені у розділі «Кадри» — залишилось підписання.',
    'Бронювання від мобілізації підтверджено, зарплата відповідає порогу 25 941 ₴. Заявку передано юристу платформи.',
    'Чек-лист адаптації надіслано співробітнику. Перше нагадування — за 2 дні до старту.',
  ],
  taras: [
    'Вітаю! Я Тарас, опрацьовую вхідні заявки. Уточніть, будь ласка, приблизний бюджет проєкту.',
    'Дякую. Лід кваліфіковано як «гарячий» — передаю менеджеру з продажів, він звʼяжеться протягом години.',
    'Комерційну пропозицію сформовано та надіслано на пошту. Нагадаю про неї через 3 дні, якщо не буде відповіді.',
    'Заявку додано до CRM. Ймовірність закриття за нашою моделлю — 62%.',
  ],
  hanna: [
    'Вітаю! Я Ганна, служба підтримки. Опишіть, будь ласка, суть звернення.',
    'Знайшла ваше замовлення в системі. Статус — «в обробці», очікуваний термін — 2 робочих дні.',
    'Питання вирішено без ескалації. Якщо повторится — одразу підключу спеціаліста-людину.',
    'Дякую за звернення! Оцініть, будь ласка, якість відповіді від 1 до 5.',
  ],
};

export const AI_WEEK = [
  { day: 'Пн', resolved: 198, escalated: 14 },
  { day: 'Вт', resolved: 224, escalated: 11 },
  { day: 'Ср', resolved: 211, escalated: 18 },
  { day: 'Чт', resolved: 247, escalated: 9 },
  { day: 'Пт', resolved: 260, escalated: 12 },
  { day: 'Сб', resolved: 132, escalated: 5 },
  { day: 'Нд', resolved: 98, escalated: 3 },
];

export const TODAY_AI_RESOLVED = 247;

export function getAgent(id: string): AgentFixture {
  const agent = AGENTS.find((a) => a.id === id);
  if (!agent) throw new Error(`Невідомий агент: ${id}`);
  return agent;
}
