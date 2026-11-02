// Общий запуск любой страницы сайта: тексты и настройки из админки, язык, шапка и подвал.
import { initI18n } from './i18n.js';
import { initLayout } from './layout.js';
import { initSiteContent } from './site-content.js';
import { initVideoModal } from '../components/video-modal.js';

export function initPage() {
  initSiteContent();
  initI18n();
  initLayout();
  initVideoModal();
}
