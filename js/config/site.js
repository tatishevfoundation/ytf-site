// Постоянные данные фонда. Меняются редко — правятся здесь, а не в Firebase.
export const SITE = {
  domain: 'ytf.kz',
  phone: '+7 (700) 331 13 14',
  phoneHref: 'tel:+77003311314',
  email: 'info@ytf.kz',
  instagram: {
    handle: '@tatishev.foundation',
    url: 'https://www.instagram.com/tatishev.foundation/',
  },
  address: {
    ru: 'г. Алматы, ул. Байзакова 125, оф. 508',
    kz: 'Алматы қ., Байзақов к-сі 125, 508-кеңсе',
    en: '125 Baizakov St., office 508, Almaty',
  },
  partner: {
    name: 'AlmaU',
    url: 'https://almau.edu.kz/',
  },
  forms: {
    bestirek: 'https://docs.google.com/forms/d/1czTYjmSGV27LYjLs_7JQRE7WnihaVMHgLUpZNQmeHxk/viewform',
    craft: 'https://docs.google.com/forms/d/1CvMkYD-dxybydieKYOTpTfRkJrnz45ZG6yrCkR_S6tg/viewform',
  },
  // ID формы Formspree (formspree.io → New form → строка вида «xyzabcd» из адреса https://formspree.io/f/xyzabcd).
  // Пока пусто — на странице контактов вместо отправки показывается подсказка написать на почту.
  formspreeId: '',
  // Карта на странице контактов (встраивание Google Maps, ключ не нужен).
  mapEmbed: 'https://maps.google.com/maps?q=%D0%90%D0%BB%D0%BC%D0%B0%D1%82%D1%8B%2C%20%D1%83%D0%BB.%20%D0%91%D0%B0%D0%B9%D0%B7%D0%B0%D0%BA%D0%BE%D0%B2%D0%B0%20125&z=16&output=embed',
};

// Ключи программ используются в Firestore (поле program у выпускников).
export const PROGRAMS = ['bestirek', 'craft', 'kentau'];
