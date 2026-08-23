export type IntentId = 'greeting' | 'vat' | 'energy' | 'booking' | 'billing' | 'unknown';

const KEYWORDS: Record<Exclude<IntentId, 'unknown'>, ReadonlyArray<string>> = {
  greeting: ['вітаю', 'привіт', 'добридень', 'добрий день', 'добрий вечір', 'hello', 'hi'],
  vat: ['пдв', 'ліміт', 'накладн', 'єрпн', 'контрагент', 'блокуван', 'подат'],
  energy: ['батар', 'заряд', 'bess', 'енерг', 'квт', 'пік', 'арбітраж', 'soc'],
  booking: ['бронюван', 'мобілізац', 'працівник', 'квот', 'критичн', 'військовозобов'],
  billing: ['тариф', 'платіж', 'цін', 'вартіст', 'рахунк', 'білінг', 'кошт'],
};

export interface IntentMatch {
  readonly id: IntentId;
  readonly score: number;
}

export function classifyIntent(text: string): IntentMatch {
  const t = text.toLowerCase();
  let best: IntentMatch = { id: 'unknown', score: 0 };
  for (const id of Object.keys(KEYWORDS) as Array<keyof typeof KEYWORDS>) {
    let score = 0;
    for (const word of KEYWORDS[id]) {
      if (t.includes(word)) score += 1;
    }
    if (score > best.score) best = { id, score };
  }
  return best;
}
