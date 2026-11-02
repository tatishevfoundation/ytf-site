// Слой данных: всё чтение из Firestore проходит здесь.
//
// Схема Firestore:
//   site/stats       { grants, graduates, exchange, startups, updatedAt }
//   site/regions     { counts: { AA: 5, ALA: 40, ... }, updatedAt }   — ключи из js/config/regions.js
//   news/{id}        { title: {ru, kz}, text: {ru, kz}, date: Timestamp, tag, photo }
//   graduates/{id}   { name: {ru, kz}, region, program, year, workplace: {ru, kz}, photo,
//                      featured: bool, story: {ru, kz} }   — featured + story → «Истории» на главной
//   reports/{id}     { title: {ru, kz}, year, pdf }
//
// Каждая функция loadX(render) сразу вызывает render() с кэшем из localStorage
// (или значениями по умолчанию), а затем — второй раз со свежими данными из Firebase.
import { getFirestore } from './firebase.js';

export const DEFAULT_STATS = { grants: 316, graduates: 123, exchange: 33, startups: 7 };

const CACHE_PREFIX = 'ytf:cache:';

function readCache(key) {
  try {
    return JSON.parse(localStorage.getItem(CACHE_PREFIX + key));
  } catch {
    return null;
  }
}

function writeCache(key, data) {
  try {
    localStorage.setItem(CACHE_PREFIX + key, JSON.stringify(data));
  } catch {
    // Приватный режим или переполненное хранилище — просто работаем без кэша.
  }
}

async function loadWithCache(key, fallback, query, render) {
  render(readCache(key) ?? fallback, { fresh: false });

  const conn = await getFirestore();
  if (!conn) return;
  try {
    const data = await query(conn);
    writeCache(key, data);
    render(data, { fresh: true });
  } catch (err) {
    console.warn(`[ytf] Не удалось загрузить «${key}» из Firebase`, err);
  }
}

// Timestamp → ISO-строка, чтобы данные можно было положить в кэш.
export function normalizeDoc(snap) {
  const data = snap.data();
  for (const [k, v] of Object.entries(data)) {
    if (v && typeof v.toDate === 'function') data[k] = v.toDate().toISOString();
  }
  return { id: snap.id, ...data };
}

export function loadStats(render) {
  return loadWithCache('stats', DEFAULT_STATS, async ({ db, fs }) => {
    const snap = await fs.getDoc(fs.doc(db, 'site', 'stats'));
    return { ...DEFAULT_STATS, ...(snap.exists() ? normalizeDoc(snap) : {}) };
  }, render);
}

export function loadRegionCounts(render) {
  return loadWithCache('regions', {}, async ({ db, fs }) => {
    const snap = await fs.getDoc(fs.doc(db, 'site', 'regions'));
    return (snap.exists() && snap.data().counts) || {};
  }, render);
}

export function loadLatestNews(count, render) {
  return loadWithCache(`news:latest:${count}`, [], async ({ db, fs }) => {
    const q = fs.query(fs.collection(db, 'news'), fs.orderBy('date', 'desc'), fs.limit(count));
    return (await fs.getDocs(q)).docs.map(normalizeDoc);
  }, render);
}

// ——— Настройки и тексты сайта (правятся в админке) ———
//   site/settings  { address: {ru, kz}, phone, email, socials: [{ name, url, icon }], forms: { bestirek, craft, kentau },
//                    donate: { methods: [{ name, icon, number, link }] }, announcement }
//   site/texts     { ru: { 'nav.home': '…' }, kz: { … } }
//   timeline/{id}  { year, title: {ru, kz}, text: {ru, kz} }
//   team/{id}      { name: {ru, kz}, role: {ru, kz}, photo, group: 'team' | 'board', order }
//   faq/{id}       { question: {ru, kz}, answer: {ru, kz}, order }

function loadDoc(key, path, render) {
  return loadWithCache(key, null, async ({ db, fs }) => {
    const snap = await fs.getDoc(fs.doc(db, ...path));
    return snap.exists() ? normalizeDoc(snap) : null;
  }, render);
}

function loadOrdered(key, collection, field, dir, render) {
  return loadWithCache(key, [], async ({ db, fs }) => {
    const q = fs.query(fs.collection(db, collection), fs.orderBy(field, dir));
    return (await fs.getDocs(q)).docs.map(normalizeDoc);
  }, render);
}

export const loadSiteSettings = (render) => loadDoc('settings', ['site', 'settings'], render);
export const loadTexts = (render) => loadDoc('texts', ['site', 'texts'], render);
//   site/pages     { heroButton: { label: {ru, kz, en} }, photos: { about, programs, scholars, graduates, donate } }
export const loadPagesDoc = (render) => loadDoc('pages', ['site', 'pages'], render);
export const loadTimeline = (render) => loadOrdered('timeline', 'timeline', 'year', 'asc', render);
export const loadTeam = (render) => loadOrdered('team', 'team', 'order', 'asc', render);
export const loadFaq = (render) => loadOrdered('faq', 'faq', 'order', 'asc', render);

//   partners/{id}  { name: {ru, kz}, text: {ru, kz}, logo, photo, url, order }
//   honors/{id}    «Достижения»: { title: {ru, kz}, text: {ru, kz}, date, category, person: {ru, kz}, photo, video, attachment, link }
//   press/{id}     { title: {ru, kz}, source, date, url, photo }
//   projects/{id}  { title: {ru, kz}, years, text: {ru, kz}, photo, order }
//   govdocs/{id}   { title: {ru, kz}, file, order }  — регламент и другие документы
//   site/founder   { name: {ru, kz}, years, photo, bio: {ru, kz} }
export const loadPartners = (render) => loadOrdered('partners', 'partners', 'order', 'asc', render);
export const loadHonors = (render) => loadOrdered('honors', 'honors', 'date', 'desc', render);
export const loadPress = (render) => loadOrdered('press', 'press', 'date', 'desc', render);
export const loadProjects = (render) => loadOrdered('projects', 'projects', 'order', 'asc', render);
export const loadGovDocs = (render) => loadOrdered('govdocs', 'govdocs', 'order', 'asc', render);
export const loadFounder = (render) => loadDoc('founder', ['site', 'founder'], render);

//   programs/{key} { key, order, visible, name, badge, lead, text, facts, requirements, documents, stages,
//                    deadline: 'YYYY-MM-DD', formUrl, regulation }  — многоязычные поля {ru, kz, en},
//                    списки — по пункту на строку
export const loadProgramDocs = (render) => loadOrdered('programs', 'programs', 'order', 'asc', render);

export function loadAllNews(render) {
  return loadWithCache('news:all', [], async ({ db, fs }) => {
    const q = fs.query(fs.collection(db, 'news'), fs.orderBy('date', 'desc'), fs.limit(200));
    return (await fs.getDocs(q)).docs.map(normalizeDoc);
  }, render);
}

export function loadGraduates(render) {
  return loadWithCache('graduates:all', [], async ({ db, fs }) => {
    const q = fs.query(fs.collection(db, 'graduates'), fs.orderBy('year', 'desc'));
    return (await fs.getDocs(q)).docs.map(normalizeDoc);
  }, render);
}

export function loadReports(render) {
  return loadWithCache('reports', [], async ({ db, fs }) => {
    const q = fs.query(fs.collection(db, 'reports'), fs.orderBy('year', 'desc'));
    return (await fs.getDocs(q)).docs.map(normalizeDoc);
  }, render);
}

export function loadFeaturedGraduates(count, render) {
  return loadWithCache(`graduates:featured:${count}`, [], async ({ db, fs }) => {
    const q = fs.query(fs.collection(db, 'graduates'), fs.where('featured', '==', true), fs.limit(count));
    return (await fs.getDocs(q)).docs.map(normalizeDoc);
  }, render);
}
