// Сценарий истории стипендиата. Всё — функции от единого прогресса p ∈ [0, 1],
// поэтому история одинаково корректно идёт вперёд, назад и при резкой прокрутке.
//
// Тайминги — доли общего прогресса. Длину участка прокрутки задаёт CSS-переменная
// --story-scroll у секции .story (index.html), а не эти числа.

export const T = {
  handover: [0.03, 0.11],     // представитель фонда передаёт папку с грантом
  handshake: [0.12, 0.19],    // рукопожатие
  turn: [0.19, 0.22],         // герой поворачивается к университету
  toUniversity: [0.22, 0.36], // идёт по дорожке, поднимается по ступеням, заходит
  seasons: [0.37, 0.57],      // лето → осень → зима → весна → лето
  exit: [0.58, 0.635],        // выходит в мантии и спускается на площадь
  cheer: [0.635, 0.70],       // радостный жест
  toOffice: [0.70, 0.865],    // идёт к офису, за деревом переодевается
  greet: [0.865, 0.925],      // у входа встречает коллега
  enterOffice: [0.925, 0.985],
};

// Главы для индикатора под сценой.
export const CHAPTERS = [
  { id: 'grant', from: 0 },
  { id: 'study', from: T.toUniversity[0] },
  { id: 'graduation', from: T.exit[0] },
  { id: 'career', from: T.toOffice[0] },
];

export const clamp01 = (v) => Math.min(1, Math.max(0, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (t) => t * t * (3 - 2 * t);
export const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);

/** Локальный прогресс внутри отрезка [a, b] → 0…1. */
export const span = (p, [a, b]) => clamp01((p - a) / (b - a));

/** Колокол: 0 → 1 → 0 внутри отрезка. */
export const bell = (t) => Math.sin(Math.PI * clamp01(t));

export function chapterAt(p) {
  let current = CHAPTERS[0].id;
  for (const c of CHAPTERS) if (p >= c.from) current = c.id;
  return current;
}

/** Ломаная с равномерной параметризацией по длине. Точки: [x, y, z]. */
export class Path {
  constructor(points) {
    this.points = points;
    this.cum = [0];
    for (let i = 1; i < points.length; i++) {
      const [ax, ay, az] = points[i - 1];
      const [bx, by, bz] = points[i];
      this.cum.push(this.cum[i - 1] + Math.hypot(bx - ax, by - ay, bz - az));
    }
    this.length = this.cum[this.cum.length - 1];
  }

  /** Точка на расстоянии d от начала. */
  at(d) {
    const dist = Math.min(Math.max(d, 0), this.length);
    let i = 1;
    while (i < this.cum.length - 1 && this.cum[i] < dist) i++;
    const seg = this.cum[i] - this.cum[i - 1] || 1;
    const k = (dist - this.cum[i - 1]) / seg;
    const a = this.points[i - 1];
    const b = this.points[i];
    return [lerp(a[0], b[0], k), lerp(a[1], b[1], k), lerp(a[2], b[2], k)];
  }

  /** Направление взгляда: смотрим на точку чуть впереди — повороты на углах получаются плавными. */
  heading(d, lookAhead = 0.35) {
    const a = this.at(Math.max(0, d - 0.05));
    const b = this.at(Math.min(this.length, d + lookAhead));
    if (Math.abs(b[0] - a[0]) + Math.abs(b[2] - a[2]) < 1e-4) return null;
    return Math.atan2(b[0] - a[0], b[2] - a[2]);
  }

  /** Расстояние вдоль пути до вершины с индексом i. */
  distTo(i) {
    return this.cum[i];
  }
}

/** Угол поворота кратчайшим путём. */
export function lerpAngle(a, b, t) {
  let diff = (b - a) % (Math.PI * 2);
  if (diff > Math.PI) diff -= Math.PI * 2;
  if (diff < -Math.PI) diff += Math.PI * 2;
  return a + diff * t;
}

/** Треугольная волна 0 → 1 → 0 с периодом 1 — для фоновых прохожих. */
export const pingPong = (x) => {
  const f = x - Math.floor(x);
  return f < 0.5 ? f * 2 : 2 - f * 2;
};
