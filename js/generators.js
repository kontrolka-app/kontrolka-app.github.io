// «Тренажёр примеров» по математике: примеры придумывает программа, она же считает ответ. Без DOM.
//
// Каждый пример — обычное задание типа number. Его id целиком задаёт пример:
//   g-<тренажёр>-<уровень>-<числа через _>   например g-mul2-medium-243_36
// По id пример собирается заново (questionFromId) — это нужно для «Повторить ошибки».
// У примеров нет topicId: тренажёр не влияет на «последний результат» тем и «освоено тем».

export const LEVELS = ['easy', 'medium', 'hard'];
export const LEVEL_LABELS = { easy: 'лёгкий', medium: 'средний', hard: 'сложный' };
export const DRILL_COUNTS = [5, 10, 20];

const COLUMN_HINT = 'Реши в черновике столбиком, потом впиши ответ.';

/** Список тренажёров. ruleTopicId — тема с правилом (ссылка «Вспомнить правило»). */
export const DRILLS = [
  { id: 'addsub', title: 'Сложение и вычитание столбиком', ruleTopicId: 'm4-add-sub', icon: '➕', sample: '38 476 + 25 658' },
  { id: 'md1', title: 'Умножение и деление на однозначное число', ruleTopicId: 'm4-mul-div-one', icon: '✖️', sample: '2 856 : 7' },
  { id: 'zeros', title: 'Умножение и деление на числа с нулями', ruleTopicId: 'm4-zeros', icon: '0️⃣', sample: '320 × 20' },
  { id: 'mul2', title: 'Умножение на двузначное и трёхзначное число', ruleTopicId: 'm4-mul-div-two', icon: '🧮', sample: '243 × 36' },
  { id: 'div2', title: 'Деление на двузначное и трёхзначное число', ruleTopicId: 'm4-mul-div-two', icon: '➗', sample: '3 096 : 43' },
  { id: 'order', title: 'Порядок действий', ruleTopicId: 'm4-repeat-order', icon: '🔣', sample: '1000 − (325 + 175) : 5 × 8' },
  { id: 'eq', title: 'Уравнения', ruleTopicId: 'm4-equations-mul-div', icon: '❓', sample: 'x × 7 = 3 500' },
  { id: 'units', title: 'Перевод величин', ruleTopicId: 'm4-length-area', icon: '📏', sample: '3 км 250 м = … м' },
];
export const DRILL_BY_ID = new Map(DRILLS.map((d) => [d.id, d]));

/* ---------- Вспомогательное ---------- */

/** Генератор случайных чисел с зерном (mulberry32). */
export function seededRandom(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const int = (rng, min, max) => min + Math.floor(rng() * (max - min + 1));
const pick = (rng, arr) => arr[Math.floor(rng() * arr.length)];
const digits = (rng, n) => int(rng, 10 ** (n - 1), 10 ** n - 1);
/** Число с пробелами между разрядами: 38 476. Неразрывный пробел — число не переносится по частям. */
export const fmt = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
const isNat = (n) => Number.isInteger(n) && n >= 0;

/* ---------- Порядок действий: вычисление «как в школе» с записью шагов ---------- */

function apply(a, op, b) {
  if (op === '+') return a + b;
  if (op === '−') return a >= b ? a - b : null;
  if (op === '×') return a * b;
  if (op === ':') return b !== 0 && a % b === 0 ? a / b : null;
  return null;
}

/**
 * Вычисляет выражение по правилам 4 класса: сначала скобки (самые внутренние),
 * потом × и : слева направо, потом + и − слева направо.
 * tokens — числа и знаки '+', '−', '×', ':', '(', ')'. Возвращает { value, steps } или null,
 * если где-то получается отрицательное число или деление не нацело.
 */
export function solveExpression(tokens) {
  const steps = [];
  const flat = (arr) => {
    const a = arr.slice();
    for (const ops of [['×', ':'], ['+', '−']]) {
      for (let i = a.findIndex((x, k) => k % 2 === 1 && ops.includes(x)); i !== -1; i = a.findIndex((x, k) => k % 2 === 1 && ops.includes(x))) {
        const r = apply(a[i - 1], a[i], a[i + 1]);
        if (r === null) return null;
        steps.push(`${fmt(a[i - 1])} ${a[i]} ${fmt(a[i + 1])} = ${fmt(r)}`);
        a.splice(i - 1, 3, r);
      }
    }
    return a.length === 1 ? a[0] : null;
  };
  const t = tokens.slice();
  while (t.includes('(')) {
    const close = t.indexOf(')');
    const open = t.lastIndexOf('(', close);
    const v = flat(t.slice(open + 1, close));
    if (v === null) return null;
    t.splice(open, close - open + 1, v);
  }
  const value = flat(t);
  return value === null ? null : { value, steps };
}

const ORDER_TEMPLATES = {
  easy: [
    ['A + B × C', { A: [10, 500], B: [2, 99], C: [2, 9] }],
    ['A − B × C', { A: [100, 900], B: [2, 50], C: [2, 9] }],
    ['A : B + C', { A: [10, 900], B: [2, 9], C: [10, 500] }],
    ['A − B : C', { A: [100, 900], B: [10, 900], C: [2, 9] }],
    ['A × B − C', { A: [10, 99], B: [2, 9], C: [10, 500] }],
  ],
  medium: [
    ['(A + B) × C − D', { A: [10, 200], B: [10, 200], C: [2, 9], D: [10, 500] }],
    ['A − (B − C) : D', { A: [100, 999], B: [50, 900], C: [10, 500], D: [2, 9] }],
    ['A × (B + C) : D', { A: [2, 50], B: [10, 90], C: [10, 90], D: [2, 9] }],
    ['(A − B) : C + D', { A: [100, 999], B: [10, 500], C: [2, 9], D: [10, 500] }],
    ['A + B × C − D', { A: [100, 900], B: [10, 99], C: [2, 9], D: [10, 500] }],
  ],
  hard: [
    ['A − (B + C) : D × E', { A: [500, 2000], B: [50, 500], C: [50, 500], D: [2, 9], E: [2, 9] }],
    ['(A − B) : C + D × E', { A: [100, 2000], B: [10, 900], C: [2, 9], D: [10, 99], E: [2, 9] }],
    ['A × B − (C + D) : E', { A: [10, 99], B: [10, 99], C: [50, 900], D: [50, 900], E: [2, 9] }],
    ['(A + B) × C − D : E', { A: [10, 200], B: [10, 200], C: [2, 9], D: [100, 900], E: [2, 9] }],
    ['A : (B − C) + D × E', { A: [100, 2000], B: [10, 50], C: [2, 9], D: [10, 99], E: [2, 9] }],
  ],
};

/** Токены выражения шаблона с подставленными числами. */
function orderTokens(template, values) {
  const out = [];
  let vi = 0;
  for (const ch of template.replace(/ /g, '')) {
    if (/[A-E]/.test(ch)) out.push(values[vi++]);
    else out.push(ch);
  }
  return out;
}
const tokensText = (tokens) => tokens.map((t) => (typeof t === 'number' ? fmt(t) : t)).join(' ').replace(/\( /g, '(').replace(/ \)/g, ')');

/* ---------- Величины ---------- */

const UNIT_PAIRS = [
  { big: 'км', small: 'м', k: 1000, smallIn: 'метрах', rule: 'm4-length-area' },
  { big: 'м', small: 'см', k: 100, smallIn: 'сантиметрах', rule: 'm4-length-area' },
  { big: 'т', small: 'кг', k: 1000, smallIn: 'килограммах', rule: 'm4-mass' },
  { big: 'ц', small: 'кг', k: 100, smallIn: 'килограммах', rule: 'm4-mass' },
  { big: 'кг', small: 'г', k: 1000, smallIn: 'граммах', rule: 'm4-mass' },
  { big: 'ч', small: 'мин', k: 60, smallIn: 'минутах', rule: 'm4-time' },
  { big: 'мин', small: 'с', k: 60, smallIn: 'секундах', rule: 'm4-time' },
  { big: 'сут', small: 'ч', k: 24, smallIn: 'часах', rule: 'm4-time' },
];

/* ---------- Сборка задания по параметрам ---------- */

const OPS = { a: '+', s: '−', m: '×', d: ':' };

/**
 * Собирает задание по тренажёру, уровню и числам. Возвращает null, если числа не подходят
 * (так questionFromId отсеивает испорченные id).
 */
export function buildQuestion(drill, level, p) {
  if (!DRILL_BY_ID.has(drill) || !LEVELS.includes(level) || !p.every((x) => typeof x === 'string' || isNat(x))) return null;
  const base = { id: `g-${drill}-${level}-${p.join('_')}`, type: 'number', difficulty: level, drill, generated: true };
  const make = (question, answer, explanation, extra = {}) => (isNat(answer) ? { ...base, question, correctAnswer: answer, explanation, ...extra } : null);

  switch (drill) {
    case 'addsub':
    case 'md1':
    case 'mul2':
    case 'div2': {
      const [opCode, a, b] = drill === 'mul2' ? ['m', p[0], p[1]] : drill === 'div2' ? ['d', p[0], p[1]] : p;
      const op = OPS[opCode];
      if (!op || !isNat(a) || !isNat(b)) return null;
      const r = apply(a, op, b);
      if (r === null || (op === ':' && b < 2)) return null;
      let expl;
      if (op === '+') expl = `Проверка вычитанием: ${fmt(r)} − ${fmt(b)} = ${fmt(a)}.`;
      else if (op === '−') expl = `Проверка сложением: ${fmt(r)} + ${fmt(b)} = ${fmt(a)}.`;
      else if (op === ':') expl = `Проверка умножением: ${fmt(r)} × ${fmt(b)} = ${fmt(a)}.`;
      else if (b >= 10) {
        // Неполные произведения: на единицы, на десятки, на сотни (нулевые пропускаем).
        const parts = [];
        String(b).split('').reverse().forEach((dig, i) => {
          if (dig !== '0') parts.push({ by: Number(dig) * 10 ** i, value: a * Number(dig) * 10 ** i });
        });
        expl = `${parts.map((x) => `${fmt(a)} × ${fmt(x.by)} = ${fmt(x.value)}`).join('; ')}. Складываем неполные произведения: ${parts.map((x) => fmt(x.value)).join(' + ')} = ${fmt(r)}.`;
      } else expl = `Умножаем столбиком справа налево, лишние десятки переносим в следующий разряд: ${fmt(a)} × ${b} = ${fmt(r)}.`;
      return make(`Вычисли: ${fmt(a)} ${op} ${fmt(b)}.`, r, expl, { hint: COLUMN_HINT });
    }
    case 'zeros': {
      const [opCode, a, b] = p;
      const op = OPS[opCode];
      if ((op !== '×' && op !== ':') || !isNat(a) || !isNat(b) || b < 2) return null;
      const r = apply(a, op, b);
      if (r === null) return null;
      let expl;
      const nul = (n) => `${n} ${n === 1 ? 'нуль' : n < 5 ? 'нуля' : 'нулей'}`;
      const pow10 = /^10+$/.test(String(b)) ? String(b).length - 1 : 0;
      if (pow10 && op === '×') expl = `Чтобы умножить на ${fmt(b)}, приписываем к числу справа ${nul(pow10)}: ${fmt(r)}.`;
      else if (pow10) expl = `Чтобы разделить на ${fmt(b)}, отбрасываем справа ${nul(pow10)}: ${fmt(r)}.`;
      else if (op === '×') {
        const za = String(a).match(/0*$/)[0].length;
        const zb = String(b).match(/0*$/)[0].length;
        const core = (a / 10 ** za) * (b / 10 ** zb);
        expl = za + zb ? `Умножаем без нулей: ${fmt(a / 10 ** za)} × ${fmt(b / 10 ** zb)} = ${fmt(core)}, потом приписываем ${za + zb} ${za + zb === 1 ? 'нуль' : za + zb < 5 ? 'нуля' : 'нулей'}: ${fmt(r)}.` : `${fmt(a)} × ${fmt(b)} = ${fmt(r)}.`;
      } else {
        const zb = Math.min(String(b).match(/0*$/)[0].length, String(a).match(/0*$/)[0].length);
        const cut = 10 ** zb;
        expl = zb
          ? `Отбрасываем у делимого и делителя поровну нулей (${zb}): ${fmt(a)} : ${fmt(b)} = ${fmt(a / cut)} : ${fmt(b / cut)} = ${fmt(r)}. Проверка: ${fmt(r)} × ${fmt(b)} = ${fmt(a)}.`
          : `Проверка умножением: ${fmt(r)} × ${fmt(b)} = ${fmt(a)}.`;
      }
      return make(`Вычисли: ${fmt(a)} ${op} ${fmt(b)}.`, r, expl, { hint: 'Сначала посчитай без нулей, потом разберись с нулями.' });
    }
    case 'order': {
      const [ti, ...values] = p;
      const tpl = ORDER_TEMPLATES[level][ti];
      if (!tpl || values.length !== (tpl[0].match(/[A-E]/g) || []).length) return null;
      const tokens = orderTokens(tpl[0], values);
      const res = solveExpression(tokens);
      if (!res) return null;
      return make(`Вычисли: ${tokensText(tokens)}.`, res.value, `По порядку: ${res.steps.join('; ')}.`, {
        hint: 'Сначала действия в скобках, потом × и : слева направо, потом + и − слева направо.',
      });
    }
    case 'eq': {
      const [kind, a, b, c] = p;
      if (!isNat(a) || !isNat(b)) return null;
      const X = 'x';
      switch (kind) {
        case 'm': // x × a = b
          if (a < 2 || b % a) return null;
          return make(`Реши уравнение: ${X} × ${fmt(a)} = ${fmt(b)}.`, b / a, `Чтобы найти неизвестный множитель, произведение делят на известный множитель: x = ${fmt(b)} : ${fmt(a)} = ${fmt(b / a)}. Проверка: ${fmt(b / a)} × ${fmt(a)} = ${fmt(b)}.`);
        case 'd': // x : a = b
          if (a < 2) return null;
          return make(`Реши уравнение: ${X} : ${fmt(a)} = ${fmt(b)}.`, a * b, `Чтобы найти неизвестное делимое, частное умножают на делитель: x = ${fmt(b)} × ${fmt(a)} = ${fmt(a * b)}. Проверка: ${fmt(a * b)} : ${fmt(a)} = ${fmt(b)}.`);
        case 'v': // a : x = b
          if (b < 2 || a % b) return null;
          return make(`Реши уравнение: ${fmt(a)} : ${X} = ${fmt(b)}.`, a / b, `Чтобы найти неизвестный делитель, делимое делят на частное: x = ${fmt(a)} : ${fmt(b)} = ${fmt(a / b)}. Проверка: ${fmt(a)} : ${fmt(a / b)} = ${fmt(b)}.`);
        case 'a': // x + a = b
          if (b <= a) return null;
          return make(`Реши уравнение: ${X} + ${fmt(a)} = ${fmt(b)}.`, b - a, `Неизвестное слагаемое = сумма − известное слагаемое: x = ${fmt(b)} − ${fmt(a)} = ${fmt(b - a)}.`);
        case 's': // x − a = b
          return make(`Реши уравнение: ${X} − ${fmt(a)} = ${fmt(b)}.`, a + b, `Неизвестное уменьшаемое = разность + вычитаемое: x = ${fmt(b)} + ${fmt(a)} = ${fmt(a + b)}.`);
        case 't': // a − x = b
          if (b >= a) return null;
          return make(`Реши уравнение: ${fmt(a)} − ${X} = ${fmt(b)}.`, a - b, `Неизвестное вычитаемое = уменьшаемое − разность: x = ${fmt(a)} − ${fmt(b)} = ${fmt(a - b)}.`);
        case 'e': // x × a = b + c
          if (!isNat(c) || a < 2 || (b + c) % a) return null;
          return make(`Реши уравнение: ${X} × ${fmt(a)} = ${fmt(b)} + ${fmt(c)}.`, (b + c) / a, `Сначала находим значение правой части: ${fmt(b)} + ${fmt(c)} = ${fmt(b + c)}. Получаем x × ${fmt(a)} = ${fmt(b + c)}, x = ${fmt(b + c)} : ${fmt(a)} = ${fmt((b + c) / a)}.`);
        default:
          return null;
      }
    }
    case 'units': {
      const [ui, n, m] = p;
      const u = UNIT_PAIRS[ui];
      if (!u || !isNat(n) || !isNat(m) || n < 1 || m >= u.k) return null;
      const whole = n * u.k;
      const text = m ? `${fmt(n)} ${u.big} ${fmt(m)} ${u.small}` : `${fmt(n)} ${u.big}`;
      const expl = `1 ${u.big} = ${fmt(u.k)} ${u.small}, поэтому ${fmt(n)} ${u.big} = ${fmt(n)} × ${fmt(u.k)} = ${fmt(whole)} ${u.small}${m ? `; ${fmt(whole)} + ${fmt(m)} = ${fmt(whole + m)} ${u.small}` : ''}.`;
      return make(`Вырази в ${u.smallIn}: ${text}.`, whole + m, expl, { unit: u.small, hint: `Вспомни: 1 ${u.big} = ${fmt(u.k)} ${u.small}.` });
    }
    default:
      return null;
  }
}

/* ---------- Случайные параметры по уровню ---------- */

function randomParams(drill, level, rng) {
  const L = LEVELS.indexOf(level);
  switch (drill) {
    case 'addsub': {
      const n = [4, 5, 6][L];
      if (rng() < 0.5) return ['a', digits(rng, n), digits(rng, n - (rng() < 0.5 ? 1 : 0))];
      // Вычитание; на среднем и сложном уровне иногда из «круглого» числа (70 000 − 34 618).
      const a = L > 0 && rng() < 0.35 ? int(rng, 2, 9) * 10 ** (n - 1) : digits(rng, n);
      const b = int(rng, 10 ** (n - 2), a - 1);
      return ['s', a, b];
    }
    case 'md1': {
      const d = int(rng, 2, 9);
      if (rng() < 0.5) return ['m', digits(rng, [3, 4, 5][L]), d];
      let q = digits(rng, [2, 3, 4][L]);
      // На среднем и сложном уровне часто нуль внутри частного (2 856 : 7 = 408) — его нельзя пропускать.
      if (L > 0 && rng() < 0.5) {
        const s = String(q).split('');
        s[int(rng, 1, s.length - 1)] = '0';
        q = Number(s.join(''));
      }
      return ['d', q * d, d];
    }
    case 'zeros': {
      if (L === 0) {
        const pow = 10 ** int(rng, 1, 3);
        return rng() < 0.5 ? ['m', int(rng, 2, 999), pow] : ['d', int(rng, 2, 999) * pow, pow];
      }
      let x, y, i, j;
      // Произведение (или делимое) — не больше миллиона: дальше в 4 классе столбиком не считают.
      do {
        x = L === 1 ? int(rng, 2, 99) : int(rng, 11, 999);
        y = L === 1 ? int(rng, 2, 9) : int(rng, 2, 99);
        i = int(rng, 0, 2);
        j = int(rng, 1, 2);
      } while (x * y * 10 ** (i + j) > 1_000_000);
      if (rng() < 0.5) return ['m', x * 10 ** i, y * 10 ** j];
      // Деление: частное x × 10^i, делитель y × 10^j.
      return ['d', x * 10 ** i * y * 10 ** j, y * 10 ** j];
    }
    case 'mul2': {
      if (L === 0) return [int(rng, 11, 99), int(rng, 11, 99)];
      if (L === 1) return [digits(rng, 3), int(rng, 11, 99)];
      let b = digits(rng, 3);
      if (rng() < 0.35) b = Math.floor(b / 100) * 100 + (b % 10 || 1); // нуль в середине: 305
      return [digits(rng, 3), b];
    }
    case 'div2': {
      const d = L === 2 ? int(rng, 101, 499) : int(rng, L === 0 ? 11 : 12, L === 0 ? 49 : 99);
      const q = L === 0 ? int(rng, 11, 99) : L === 1 ? digits(rng, 3) : int(rng, 11, 299);
      return [q * d, d];
    }
    case 'order': {
      const tpls = ORDER_TEMPLATES[level];
      const ti = int(rng, 0, tpls.length - 1);
      const [t, ranges] = tpls[ti];
      const names = t.match(/[A-E]/g);
      for (let tries = 0; tries < 500; tries++) {
        const values = names.map((nm) => int(rng, ...ranges[nm]));
        const res = solveExpression(orderTokens(t, values));
        if (res && res.value <= 100000) return [ti, ...values];
      }
      return null;
    }
    case 'eq': {
      const kinds = [['m', 'd', 'a', 's'], ['m', 'd', 'v', 'a', 's', 't'], ['m', 'd', 'v', 't', 'e']][L];
      const kind = pick(rng, kinds);
      const small = () => (L === 0 ? int(rng, 2, 9) : int(rng, 2, 99));
      const big = () => digits(rng, [3, 4, 5][L]);
      if (kind === 'm') {
        const a = small();
        return ['m', a, a * int(rng, 10, [99, 999, 999][L])];
      }
      if (kind === 'd') return ['d', small(), int(rng, 10, [999, 999, 9999][L])];
      if (kind === 'v') {
        const x = int(rng, 2, 99);
        const b = int(rng, 2, [0, 99, 999][L]);
        return ['v', x * b, b];
      }
      if (kind === 'a') {
        const a = big();
        return ['a', a, a + big()];
      }
      if (kind === 's') return ['s', big(), big()];
      if (kind === 't') {
        const a = big();
        return ['t', a, int(rng, 1, a - 1)];
      }
      // x × a = b + c
      const a = int(rng, 2, 9);
      const total = a * int(rng, 10, 999);
      const b = int(rng, 1, total - 1);
      return ['e', a, b, total - b];
    }
    case 'units': {
      const ui = int(rng, 0, UNIT_PAIRS.length - 1);
      const k = UNIT_PAIRS[ui].k;
      if (L === 0) return [ui, int(rng, 1, 9), 0];
      if (L === 1) return [ui, int(rng, 1, 9), int(rng, 1, k - 1)];
      // Сложный: побольше и с «короткой» второй частью (5 т 40 кг, 2 км 5 м).
      const m = rng() < 0.6 ? int(rng, 1, Math.max(1, Math.floor(k / 10) - 1)) : int(rng, 1, k - 1);
      return [ui, int(rng, 10, ui >= 5 ? 23 : 99), m];
    }
    default:
      return null;
  }
}

/** Один случайный пример тренажёра. */
export function generateQuestion(drill, level, rng = Math.random) {
  for (let tries = 0; tries < 50; tries++) {
    const p = randomParams(drill, level, rng);
    const q = p && buildQuestion(drill, level, p);
    if (q) return q;
  }
  return null;
}

/** Набор из count разных примеров. */
export function generateSet(drill, level, count, rng = Math.random) {
  const out = new Map();
  for (let tries = 0; out.size < count && tries < count * 30; tries++) {
    const q = generateQuestion(drill, level, rng);
    if (q && !out.has(q.id)) out.set(q.id, q);
  }
  return [...out.values()];
}

/** Собирает пример заново по id (для «Повторить ошибки»). null — если id не от тренажёра или испорчен. */
export function questionFromId(id) {
  const m = /^g-([a-z0-9]+)-(easy|medium|hard)-([a-z0-9_]+)$/.exec(String(id));
  if (!m) return null;
  const p = m[3].split('_').map((x) => (/^\d+$/.test(x) ? Number(x) : x));
  const q = buildQuestion(m[1], m[2], p);
  return q && q.id === id ? q : null;
}
