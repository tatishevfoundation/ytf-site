// Админ-панель: вход через Firebase Auth и навигация по разделам.
// Писать в базу и загружать файлы могут только пользователи из коллекции admins
// (см. firestore.rules и storage.rules).
import { getAuth, getFirestore, isFirebaseConfigured } from '../core/firebase.js';
import { COLLECTIONS, renderCollection } from '../admin/collections.js';
import { renderFounder } from '../admin/founder.js';
import { renderPages } from '../admin/pages.js';
import { renderSettings } from '../admin/settings.js';
import { renderRegions, renderStats } from '../admin/stats.js';
import { renderTexts } from '../admin/texts.js';
import { $, ctx, toast } from '../admin/ui.js';

ctx.main = $('admin-main');
let auth;
let fa;

function show(screen) {
  for (const name of ['config', 'login', 'denied', 'app']) $(`screen-${name}`).hidden = name !== screen;
}

// ——— Навигация по разделам ———

const SECTIONS = {
  stats: renderStats,
  regions: renderRegions,
  texts: renderTexts,
  settings: renderSettings,
  pages: renderPages,
  founder: renderFounder,
};

function openTab(name) {
  ctx.tab = name;
  document.querySelectorAll('[data-tab]').forEach((b) => {
    if (b.dataset.tab === name) b.setAttribute('aria-current', 'page');
    else b.removeAttribute('aria-current');
  });
  window.scrollTo(0, 0);
  if (SECTIONS[name]) SECTIONS[name]();
  else if (COLLECTIONS[name]) renderCollection(name);
}

document.querySelector('.admin-nav').addEventListener('click', (e) => {
  const tab = e.target.closest('[data-tab]')?.dataset.tab;
  if (tab) openTab(tab);
});

// ——— Вход ———

const AUTH_ERRORS = {
  'auth/invalid-credential': 'Неверный email или пароль.',
  'auth/wrong-password': 'Неверный email или пароль.',
  'auth/user-not-found': 'Неверный email или пароль.',
  'auth/invalid-email': 'Проверьте email.',
  'auth/too-many-requests': 'Слишком много попыток. Попробуйте через несколько минут.',
  'auth/network-request-failed': 'Нет соединения с интернетом.',
};

function loginError(message) {
  const el = $('login-error');
  el.hidden = !message;
  el.textContent = message ?? '';
}

$('login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = e.currentTarget;
  if (!form.reportValidity()) return;
  loginError(null);
  const button = form.querySelector('[type="submit"]');
  button.disabled = true;
  try {
    await fa.signInWithEmailAndPassword(auth, form.email.value.trim(), form.password.value);
  } catch (err) {
    loginError(AUTH_ERRORS[err.code] ?? 'Не удалось войти. Попробуйте ещё раз.');
  } finally {
    button.disabled = false;
  }
});

$('reset-password').addEventListener('click', async () => {
  const email = $('login-form').email.value.trim();
  if (!email) {
    loginError('Введите email, на который зарегистрирован аккаунт, и нажмите ещё раз.');
    return;
  }
  try {
    await fa.sendPasswordResetEmail(auth, email);
    loginError(null);
    toast('Письмо для смены пароля отправлено');
  } catch (err) {
    loginError(AUTH_ERRORS[err.code] ?? 'Не удалось отправить письмо.');
  }
});

$('logout').addEventListener('click', () => fa.signOut(auth));

async function boot() {
  if (!isFirebaseConfigured) {
    show('config');
    return;
  }
  ({ db: ctx.db, fs: ctx.fs } = await getFirestore());
  ({ auth, fa } = await getAuth());
  fa.onAuthStateChanged(auth, async (user) => {
    $('user-box').hidden = !user;
    if (!user) {
      show('login');
      return;
    }
    $('user-email').textContent = user.email ?? '';
    try {
      const adminDoc = await ctx.fs.getDoc(ctx.fs.doc(ctx.db, 'admins', user.uid));
      if (!adminDoc.exists()) {
        show('denied');
        return;
      }
    } catch {
      show('denied');
      return;
    }
    show('app');
    openTab(ctx.tab);
  });
}

boot();
