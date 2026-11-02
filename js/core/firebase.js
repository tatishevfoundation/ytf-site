// Подключение к Firebase. SDK грузится с CDN только когда config заполнен,
// поэтому страницы без настроенного Firebase не тянут лишние ~100 КБ.
import { firebaseConfig } from '../config/firebase-config.js';

const FIREBASE_VERSION = '10.14.1';
const CDN = `https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}`;

// Для проверки вёрстки на своём компьютере: localhost:8080/about.html?offline — без базы, только данные из кэша браузера.
const offline = ['localhost', '127.0.0.1'].includes(location.hostname) && new URLSearchParams(location.search).has('offline');

export const isFirebaseConfigured = !offline && Boolean(firebaseConfig.apiKey && firebaseConfig.projectId);

let appPromise;
let firestorePromise;
let authPromise;

function getApp() {
  appPromise ??= import(`${CDN}/firebase-app.js`).then(({ initializeApp, getApps }) =>
    getApps()[0] ?? initializeApp(firebaseConfig),
  );
  return appPromise;
}

/** @returns {Promise<{db: object, fs: object} | null>} fs — модуль firebase-firestore */
export function getFirestore() {
  if (!isFirebaseConfigured) return Promise.resolve(null);
  firestorePromise ??= Promise.all([getApp(), import(`${CDN}/firebase-firestore.js`)]).then(
    ([app, fs]) => ({ db: fs.getFirestore(app), fs }),
  );
  return firestorePromise;
}

let storagePromise;

/** Для загрузки файлов из админки. @returns {Promise<{storage: object, st: object} | null>} st — модуль firebase-storage */
export function getStorage() {
  if (!isFirebaseConfigured) return Promise.resolve(null);
  storagePromise ??= Promise.all([getApp(), import(`${CDN}/firebase-storage.js`)]).then(
    ([app, st]) => ({ storage: st.getStorage(app), st }),
  );
  return storagePromise;
}

/** Для админ-панели. @returns {Promise<{auth: object, fa: object} | null>} */
export function getAuth() {
  if (!isFirebaseConfigured) return Promise.resolve(null);
  authPromise ??= Promise.all([getApp(), import(`${CDN}/firebase-auth.js`)]).then(
    ([app, fa]) => ({ auth: fa.getAuth(app), fa }),
  );
  return authPromise;
}
