// Интерактивная тепловая карта Казахстана.
//   const map = new KzMap(container, { onSelect: (code) => … });
//   await map.init();
//   map.setCounts({ AA: 5, ALA: 40, … });
//
// Границы — GeoJSON уровня областей из open-data-kazakhstan/geo-boundaries-kz.
// Сначала берём локальную копию data/geo/kz_1.json, если её нет — оригинал с GitHub.
import { AREAS, CITIES, HUB_CITY, REGIONS } from '../config/regions.js';
import { getLang, plural, t } from '../core/i18n.js';
import { escapeHtml, formatNumber, prefersReducedMotion } from '../core/utils.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const GEO_SOURCES = [
  'data/geo/kz_1.json',
  'https://raw.githubusercontent.com/open-data-kazakhstan/geo-boundaries-kz/master/data/geojson/kz_1.json',
];
const WIDTH = 1000;
const PAD = 24;
const MIN_STEP = 0.8; // точки контура ближе этого расстояния (в единицах viewBox) отбрасываются

let uid = 0;

const toRad = (deg) => (deg * Math.PI) / 180;
const mercator = ([lon, lat]) => [toRad(lon), Math.log(Math.tan(Math.PI / 4 + toRad(lat) / 2))];

function svgEl(tag, attrs = {}) {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [name, value] of Object.entries(attrs)) el.setAttribute(name, value);
  return el;
}

async function fetchGeo() {
  for (const url of GEO_SOURCES) {
    try {
      const res = await fetch(url);
      if (res.ok) return await res.json();
    } catch {
      // пробуем следующий источник
    }
  }
  throw new Error('[kz-map] GeoJSON с границами недоступен');
}

function polygonsOf(geometry) {
  if (geometry?.type === 'Polygon') return [geometry.coordinates];
  if (geometry?.type === 'MultiPolygon') return geometry.coordinates;
  return [];
}

function ringToPath(ring) {
  let d = '';
  let last = null;
  ring.forEach((p, i) => {
    const isLast = i === ring.length - 1;
    if (last && !isLast && Math.hypot(p[0] - last[0], p[1] - last[1]) < MIN_STEP) return;
    d += `${d ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`;
    last = p;
  });
  return `${d}Z`;
}

// Центр масс многоугольника (формула через площадь) — точка, откуда начинается маршрут.
function ringCentroid(ring) {
  let area = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [x0, y0] = ring[j];
    const [x1, y1] = ring[i];
    const f = x0 * y1 - x1 * y0;
    area += f;
    cx += (x0 + x1) * f;
    cy += (y0 + y1) * f;
  }
  area /= 2;
  return { area: Math.abs(area), point: [cx / (6 * area), cy / (6 * area)] };
}

export class KzMap {
  constructor(container, { onSelect } = {}) {
    this.container = container;
    this.onSelect = onSelect;
    this.counts = {};
    this.areas = new Map(); // code → { el, anchor: [x, y] }
    this.selected = null;
    this.revealAnimation = null;
  }

  async init() {
    this.container.classList.add('kz-map');
    this.container.innerHTML = `<p class="kz-map__status" data-i18n="map.loading">${escapeHtml(t('map.loading'))}</p>`;
    let geo;
    try {
      geo = await fetchGeo();
    } catch (err) {
      console.error(err);
      const status = this.container.querySelector('.kz-map__status');
      status.dataset.i18n = 'map.error';
      status.textContent = t('map.error');
      return;
    }
    this.build(geo);
    this.bindEvents();
    this.paint();
    document.addEventListener('langchange', () => this.relabel());
  }

  setCounts(counts) {
    this.counts = counts ?? {};
    if (this.svg) this.paint();
  }

  count(code) {
    const n = Number(this.counts[code]);
    return Number.isFinite(n) && n > 0 ? n : 0;
  }

  // ——— построение SVG ———

  build(geo) {
    const features = geo.features
      .map((f) => ({
        code: String(f.properties?.HASC_1 ?? '').replace(/^KZ\./, ''),
        polygons: polygonsOf(f.geometry).map((poly) => poly.map((ring) => ring.map(mercator))),
      }))
      .filter((f) => REGIONS[f.code]);

    let minX = Infinity; let maxX = -Infinity; let minY = Infinity; let maxY = -Infinity;
    for (const f of features) {
      for (const poly of f.polygons) {
        for (const [x, y] of poly[0]) {
          minX = Math.min(minX, x); maxX = Math.max(maxX, x);
          minY = Math.min(minY, y); maxY = Math.max(maxY, y);
        }
      }
    }
    const scale = (WIDTH - PAD * 2) / (maxX - minX);
    this.height = Math.ceil((maxY - minY) * scale + PAD * 2);
    const toView = ([x, y]) => [PAD + (x - minX) * scale, PAD + (maxY - y) * scale];

    const maskId = `kz-route-mask-${++uid}`;
    this.svg = svgEl('svg', {
      class: 'kz-map__svg',
      viewBox: `0 0 ${WIDTH} ${this.height}`,
      role: 'group',
    });

    const defs = svgEl('defs');
    const mask = svgEl('mask', {
      id: maskId, maskUnits: 'userSpaceOnUse', x: 0, y: 0, width: WIDTH, height: this.height,
    });
    this.reveal = svgEl('path', { fill: 'none', stroke: '#fff', 'stroke-width': 14, 'stroke-linecap': 'round' });
    mask.append(this.reveal);
    defs.append(mask);

    const regionsLayer = svgEl('g', { class: 'kz-map__regions' });
    for (const f of features) {
      const rings = f.polygons.map((poly) => poly.map((ring) => ring.map(toView)));
      const d = rings.flat().map(ringToPath).join('');
      const largest = rings
        .map((poly) => ringCentroid(poly[0]))
        .reduce((a, b) => (b.area > a.area ? b : a));
      const path = svgEl('path', {
        class: 'kz-map__region', d, 'data-code': f.code, tabindex: 0, role: 'button', 'aria-pressed': 'false',
      });
      regionsLayer.append(path);
      this.areas.set(f.code, { el: path, anchor: largest.point });
    }

    this.routeLayer = svgEl('g', { class: 'kz-map__route-layer', 'aria-hidden': 'true' });
    this.route = svgEl('path', { class: 'kz-map__route', mask: `url(#${maskId})` });
    this.routeStart = svgEl('circle', { class: 'kz-map__route-start', r: 6 });
    this.routeLayer.append(this.route, this.routeStart);

    const citiesLayer = svgEl('g', { class: 'kz-map__cities' });
    for (const [code, city] of Object.entries(CITIES)) {
      const [x, y] = toView(mercator([city.lon, city.lat]));
      const isHub = code === HUB_CITY;
      const g = svgEl('g', {
        class: `kz-map__city${isHub ? ' kz-map__city--hub' : ''}`,
        transform: `translate(${x.toFixed(1)} ${y.toFixed(1)})`,
        'data-code': code, tabindex: 0, role: 'button', 'aria-pressed': 'false',
      });
      if (isHub) {
        g.append(
          svgEl('circle', { class: 'kz-map__pulse', r: 9 }),
          svgEl('circle', { class: 'kz-map__pulse kz-map__pulse--late', r: 9 }),
          svgEl('circle', { class: 'kz-map__hub-dot', r: 8 }),
        );
      } else {
        g.append(svgEl('circle', { class: 'kz-map__city-dot', r: 7 }));
      }
      const label = svgEl('text', { class: 'kz-map__city-label', x: 13, y: 5 });
      g.append(label);
      citiesLayer.append(g);
      this.areas.set(code, { el: g, anchor: [x, y], label });
    }

    this.svg.append(defs, regionsLayer, this.routeLayer, citiesLayer);

    this.tooltip = document.createElement('div');
    this.tooltip.className = 'kz-map__tooltip';
    this.tooltip.hidden = true;

    const canvas = document.createElement('div');
    canvas.className = 'kz-map__canvas';
    canvas.append(this.svg, this.tooltip);
    this.canvas = canvas;

    const footer = document.createElement('div');
    footer.className = 'kz-map__footer';
    footer.innerHTML = '<p class="kz-map__total"></p>';
    this.totalEl = footer.querySelector('.kz-map__total');

    this.container.replaceChildren(canvas, footer);
    this.relabel();
  }

  // ——— данные и подписи ———

  paint() {
    const max = Math.max(0, ...[...this.areas.keys()].map((code) => this.count(code)));
    let total = 0;
    for (const [code, { el }] of this.areas) {
      const n = this.count(code);
      total += n;
      el.classList.toggle('is-empty', n === 0);
      // корень сглаживает разброс: регионы с 1–2 выпускниками остаются заметными
      el.style.setProperty('--heat', max ? `${Math.round(18 + 82 * Math.sqrt(n / max))}%` : '0%');
    }
    this.totalEl.textContent = t('map.total', {
      count: formatNumber(total),
      noun: plural('stats.graduates', total),
    });
    this.updateLabels();
  }

  describe(code) {
    const n = this.count(code);
    return { name: AREAS[code][getLang()], text: `${formatNumber(n)} ${plural('stats.graduates', n)}` };
  }

  updateLabels() {
    this.svg.setAttribute('aria-label', t('map.label'));
    for (const [code, { el, label }] of this.areas) {
      const { name, text } = this.describe(code);
      el.setAttribute('aria-label', `${name}: ${text}`);
      if (label) label.textContent = name;
    }
    if (this.selected) this.showTooltipAtAnchor(this.selected);
  }

  relabel() {
    if (this.svg) this.paint();
  }

  // ——— подсказка ———

  showTooltip(code, clientX, clientY) {
    const { name, text } = this.describe(code);
    this.tooltip.innerHTML = `<strong>${escapeHtml(name)}</strong><span>${escapeHtml(text)}</span>`;
    this.tooltip.hidden = false;
    const rect = this.canvas.getBoundingClientRect();
    const half = this.tooltip.offsetWidth / 2;
    const left = Math.min(Math.max(clientX - rect.left, half + 4), rect.width - half - 4);
    const top = clientY - rect.top;
    this.tooltip.style.left = `${left}px`;
    this.tooltip.style.top = `${top}px`;
    this.tooltip.classList.toggle('is-below', top < this.tooltip.offsetHeight + 16);
  }

  showTooltipAtAnchor(code) {
    const [x, y] = this.areas.get(code).anchor;
    const point = new DOMPoint(x, y).matrixTransform(this.svg.getScreenCTM());
    this.showTooltip(code, point.x, point.y);
  }

  restoreTooltip() {
    if (this.selected) this.showTooltipAtAnchor(this.selected);
    else this.tooltip.hidden = true;
  }

  // ——— выбор региона и маршрут до Алматы ———

  select(code) {
    if (this.selected === code) {
      this.clear();
      return;
    }
    this.selected = code;
    for (const [c, { el }] of this.areas) {
      el.classList.toggle('is-selected', c === code);
      el.setAttribute('aria-pressed', String(c === code));
    }
    this.drawRoute(code);
    this.showTooltipAtAnchor(code);
    this.onSelect?.(code);
  }

  clear() {
    if (!this.selected) return;
    this.selected = null;
    for (const { el } of this.areas.values()) {
      el.classList.remove('is-selected');
      el.setAttribute('aria-pressed', 'false');
    }
    this.routeLayer.classList.remove('is-visible');
    this.tooltip.hidden = true;
    this.onSelect?.(null);
  }

  drawRoute(code) {
    this.revealAnimation?.cancel();
    if (code === HUB_CITY) {
      this.routeLayer.classList.remove('is-visible');
      return;
    }
    const [x1, y1] = this.areas.get(code).anchor;
    const [x2, y2] = this.areas.get(HUB_CITY).anchor;
    const dist = Math.hypot(x2 - x1, y2 - y1) || 1;
    // изгибаем дугу вверх, перпендикулярно отрезку
    let nx = -(y2 - y1) / dist;
    let ny = (x2 - x1) / dist;
    if (ny > 0) { nx = -nx; ny = -ny; }
    const bend = Math.min(dist * 0.22, 110);
    const cx = (x1 + x2) / 2 + nx * bend;
    const cy = (y1 + y2) / 2 + ny * bend;
    const d = `M${x1.toFixed(1)},${y1.toFixed(1)} Q${cx.toFixed(1)},${cy.toFixed(1)} ${x2.toFixed(1)},${y2.toFixed(1)}`;

    this.route.setAttribute('d', d);
    this.reveal.setAttribute('d', d);
    this.routeStart.setAttribute('cx', x1);
    this.routeStart.setAttribute('cy', y1);

    const length = this.reveal.getTotalLength();
    this.reveal.style.strokeDasharray = `${length}`;
    this.reveal.style.strokeDashoffset = '0';
    if (!prefersReducedMotion()) {
      this.revealAnimation = this.reveal.animate(
        [{ strokeDashoffset: length }, { strokeDashoffset: 0 }],
        { duration: 1100, easing: 'cubic-bezier(.45, 0, .2, 1)', fill: 'forwards' },
      );
    }
    // перезапуск CSS-анимации появления
    this.routeLayer.classList.remove('is-visible');
    void this.routeLayer.getBoundingClientRect();
    this.routeLayer.classList.add('is-visible');
  }

  // ——— события ———

  bindEvents() {
    const codeOf = (target) => target.closest?.('[data-code]')?.dataset.code;

    this.svg.addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse') return;
      const code = codeOf(e.target);
      if (code) this.showTooltip(code, e.clientX, e.clientY);
      else this.restoreTooltip();
    });
    this.svg.addEventListener('pointerleave', () => this.restoreTooltip());

    this.svg.addEventListener('click', (e) => {
      const code = codeOf(e.target);
      if (code) this.select(code);
      else this.clear();
    });

    this.svg.addEventListener('keydown', (e) => {
      const code = codeOf(e.target);
      if (code && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault();
        this.select(code);
      } else if (e.key === 'Escape') {
        this.clear();
      }
    });
    this.svg.addEventListener('focusin', (e) => {
      const code = codeOf(e.target);
      if (code) this.showTooltipAtAnchor(code);
    });
    this.svg.addEventListener('focusout', () => this.restoreTooltip());

    window.addEventListener('resize', () => this.restoreTooltip(), { passive: true });
  }
}
