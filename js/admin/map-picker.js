// Выбор точки офиса на карте (админка → «Контакты»). Карта — Leaflet + OpenStreetMap,
// поиск по адресу — Nominatim. На сайте точка показывается в карте Google (js/pages/contacts.js).
import { toast } from './ui.js';

const LEAFLET = 'https://unpkg.com/leaflet@1.9.4/dist';
const ALMATY = [43.2389, 76.8897];

let leafletPromise;

function loadLeaflet() {
  leafletPromise ??= new Promise((resolve, reject) => {
    const css = document.createElement('link');
    css.rel = 'stylesheet';
    css.href = `${LEAFLET}/leaflet.css`;
    document.head.append(css);
    const script = document.createElement('script');
    script.src = `${LEAFLET}/leaflet.js`;
    script.onload = () => resolve(window.L);
    script.onerror = reject;
    document.head.append(script);
  });
  return leafletPromise;
}

const round = (n) => Math.round(n * 1e6) / 1e6;

/**
 * point — сохранённая точка { lat, lng } или null; getAddress() — адрес для поиска.
 * Возвращает { point() } — текущая точка для сохранения.
 */
export function initMapPicker({ el, coordsEl, findBtn, clearBtn, point, getAddress }) {
  let current = point && Number.isFinite(point.lat) ? { lat: point.lat, lng: point.lng } : null;
  let map;
  let marker;
  let L;

  const showCoords = () => {
    coordsEl.textContent = current ? `Метка: ${current.lat}, ${current.lng}` : 'Метка не выбрана — карта на сайте ищет по адресу.';
    clearBtn.hidden = !current;
  };

  const setPoint = (latlng, { pan = false } = {}) => {
    current = { lat: round(latlng.lat), lng: round(latlng.lng) };
    if (!marker) {
      marker = L.marker(latlng, { draggable: true }).addTo(map);
      marker.on('dragend', () => setPoint(marker.getLatLng()));
    } else marker.setLatLng(latlng);
    if (pan) map.setView(latlng, 17);
    showCoords();
  };

  showCoords();
  loadLeaflet().then((leaflet) => {
    L = leaflet;
    el.innerHTML = '';
    map = L.map(el).setView(current ? [current.lat, current.lng] : ALMATY, current ? 17 : 12);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);
    if (current) setPoint(current);
    map.on('click', (e) => setPoint(e.latlng));
  }).catch(() => {
    el.innerHTML = '<p class="admin-error">Не удалось загрузить карту. Проверьте интернет и обновите страницу.</p>';
  });

  findBtn.addEventListener('click', async () => {
    if (!map) return;
    const address = getAddress();
    if (!address) {
      toast('Сначала заполните адрес (RU).', 'error');
      return;
    }
    findBtn.disabled = true;
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=kz&accept-language=ru&q=${encodeURIComponent(address)}`;
      const [found] = await (await fetch(url)).json();
      if (found) setPoint({ lat: Number(found.lat), lng: Number(found.lon) }, { pan: true });
      else toast('Адрес не найден. Отметьте офис на карте вручную.', 'error');
    } catch {
      toast('Поиск не сработал. Отметьте офис на карте вручную.', 'error');
    } finally {
      findBtn.disabled = false;
    }
  });

  clearBtn.addEventListener('click', () => {
    current = null;
    marker?.remove();
    marker = null;
    showCoords();
  });

  return { point: () => current };
}
