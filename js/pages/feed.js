// Ленты записей с полным текстом по ссылке page.html#<id>:
// «Новости» (<body data-feed="news">) и «Достижения» (<body data-feed="achievements">).
import { getLang, t } from '../core/i18n.js';
import { initPage } from '../core/page.js';
import { loadAllNews, loadHonors } from '../core/data.js';
import { isFirebaseConfigured } from '../core/firebase.js';
import { escapeHtml, formatDate, localized, safeUrl } from '../core/utils.js';
import { videoPlayer } from '../core/media.js';
import {
  HONOR_CATEGORIES, feedCard, honorTag, newsTag,
} from '../components/cards.js';

initPage();

const FEEDS = {
  news: {
    href: 'news.html',
    page: 'newsPage',
    load: loadAllNews,
    field: 'tag',
    tags: ['events', 'programs', 'graduates', 'foundation'],
    tagLabel: (tag) => t(`news.tags.${tag}`),
    tagOf: newsTag,
    none: 'home.news.empty',
    empty: 'home.news.empty',
  },
  achievements: {
    href: 'achievements.html',
    page: 'achievementsPage',
    load: loadHonors,
    field: 'category',
    tags: HONOR_CATEGORIES,
    tagLabel: (c) => t(`honors.categories.${c}`),
    tagOf: honorTag,
    none: 'achievementsPage.none',
    empty: 'achievementsPage.empty',
  },
};

const feed = FEEDS[document.body.dataset.feed] ?? FEEDS.news;
const state = { items: [], tag: '', loaded: false };

const el = {
  feed: document.getElementById('feed'),
  tags: document.getElementById('feed-tags'),
  list: document.getElementById('feed-list'),
  articleWrap: document.getElementById('feed-article'),
  article: document.getElementById('article'),
};

function renderTags() {
  const used = feed.tags.filter((tag) => state.items.some((n) => n[feed.field] === tag));
  el.tags.innerHTML = ['', ...used].map((tag) => `
    <button type="button" class="chip" data-tag="${tag}" aria-pressed="${state.tag === tag}">
      ${escapeHtml(tag ? feed.tagLabel(tag) : t('filters.all'))}
    </button>`).join('');
  el.tags.hidden = used.length < 2;
}

function renderList() {
  const lang = getLang();
  if (!state.items.length) {
    el.list.innerHTML = `<p class="empty-state">${escapeHtml(t(feed.none))}</p>`;
    return;
  }
  const items = state.items.filter((n) => !state.tag || n[feed.field] === state.tag);
  el.list.innerHTML = items.length
    ? items.map((item) => feedCard(item, lang, { href: feed.href, tag: feed.tagOf(item), heading: 'h2' })).join('')
    : `<p class="empty-state">${escapeHtml(t(feed.empty))}</p>`;
}

function renderArticle(id) {
  const lang = getLang();
  const item = state.items.find((n) => n.id === id);
  const back = `<a class="arrow-link article__back" href="${feed.href}">${escapeHtml(t(`${feed.page}.back`))}</a>`;
  if (!item) {
    el.article.innerHTML = state.loaded ? `${back}<p class="empty-state">${escapeHtml(t(`${feed.page}.notFound`))}</p>` : '';
    return;
  }
  const title = localized(item.title, lang);
  const tag = feed.tagOf(item);
  const person = localized(item.person, lang);
  const photo = safeUrl(item.photo);
  const link = safeUrl(item.link);
  const attachment = safeUrl(item.attachment);
  // абзацы — по пустой строке в тексте
  const body = localized(item.text, lang).split(/\n\s*\n/).filter((p) => p.trim())
    .map((p) => `<p>${escapeHtml(p.trim())}</p>`).join('');
  el.article.innerHTML = `
    ${back}
    <p class="article__meta">
      ${tag ? `<span class="news-card__tag">${escapeHtml(tag)}</span>` : ''}
      ${item.date ? `<time datetime="${escapeHtml(item.date)}">${escapeHtml(formatDate(item.date, lang))}</time>` : ''}
    </p>
    <h1 class="article__title">${escapeHtml(title)}</h1>
    ${person ? `<p class="article__person">${escapeHtml(person)}</p>` : ''}
    ${item.video ? videoPlayer(item.video, title) : ''}
    ${photo ? `<img class="article__photo" src="${escapeHtml(photo)}" alt="">` : ''}
    <div class="article__body">${body}</div>
    ${attachment ? `
      <a class="attachment" href="${escapeHtml(attachment)}" target="_blank" rel="noopener">
        <span class="attachment__icon" aria-hidden="true">↓</span>
        <span>${escapeHtml(item.attachmentName || t('newsPage.attachment'))}</span>
      </a>` : ''}
    ${link ? `<p><a class="arrow-link" href="${escapeHtml(link)}" target="_blank" rel="noopener">${escapeHtml(t('honors.more'))}</a></p>` : ''}`;
  document.title = `${title} — ${t('common.foundation')}`;
}

function route() {
  const id = decodeURIComponent(location.hash.slice(1));
  const showArticle = Boolean(id);
  el.feed.hidden = showArticle;
  el.articleWrap.hidden = !showArticle;
  if (showArticle) renderArticle(id);
  else {
    document.title = t(`${feed.page}.metaTitle`);
    renderTags();
    renderList();
  }
}

el.tags.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-tag]');
  if (!btn) return;
  state.tag = btn.dataset.tag;
  renderTags();
  renderList();
});

window.addEventListener('hashchange', () => {
  route();
  window.scrollTo(0, 0);
});

feed.load((items, { fresh }) => {
  state.items = items;
  state.loaded = fresh || state.loaded || !isFirebaseConfigured;
  route();
});

document.addEventListener('langchange', route);
