// Регионы карты. Ключи — коды из поля HASC_1 файла kz_1.json без префикса «KZ.»
// (точки в ключах Firestore недопустимы). Те же ключи используются в документе site/regions.
//
// Границы взяты из open-data-kazakhstan/geo-boundaries-kz (GADM 3.6) — это 14 областей
// до реформы 2022 года. Выпускников из новых областей учитываем в «родительских»:
// Абайская → Восточно-Казахстанская (EK), Жетысуская → Алматинская (AA),
// Улытауская → Карагандинская (QG).
export const REGIONS = {
  AA: { ru: 'Алматинская область', kz: 'Алматы облысы', en: 'Almaty Region' },
  AM: { ru: 'Акмолинская область', kz: 'Ақмола облысы', en: 'Akmola Region' },
  AT: { ru: 'Актюбинская область', kz: 'Ақтөбе облысы', en: 'Aktobe Region' },
  AR: { ru: 'Атырауская область', kz: 'Атырау облысы', en: 'Atyrau Region' },
  EK: { ru: 'Восточно-Казахстанская область', kz: 'Шығыс Қазақстан облысы', en: 'East Kazakhstan Region' },
  MG: { ru: 'Мангистауская область', kz: 'Маңғыстау облысы', en: 'Mangystau Region' },
  NK: { ru: 'Северо-Казахстанская область', kz: 'Солтүстік Қазақстан облысы', en: 'North Kazakhstan Region' },
  PA: { ru: 'Павлодарская область', kz: 'Павлодар облысы', en: 'Pavlodar Region' },
  QG: { ru: 'Карагандинская область', kz: 'Қарағанды облысы', en: 'Karaganda Region' },
  QS: { ru: 'Костанайская область', kz: 'Қостанай облысы', en: 'Kostanay Region' },
  QO: { ru: 'Кызылординская область', kz: 'Қызылорда облысы', en: 'Kyzylorda Region' },
  SK: { ru: 'Туркестанская область', kz: 'Түркістан облысы', en: 'Turkistan Region' },
  WK: { ru: 'Западно-Казахстанская область', kz: 'Батыс Қазақстан облысы', en: 'West Kazakhstan Region' },
  ZM: { ru: 'Жамбылская область', kz: 'Жамбыл облысы', en: 'Zhambyl Region' },
};

// Города республиканского значения — на карте это точки, а не полигоны.
export const CITIES = {
  ALA: { ru: 'Алматы', kz: 'Алматы', en: 'Almaty', lon: 76.9286, lat: 43.2567 },
  AST: { ru: 'Астана', kz: 'Астана', en: 'Astana', lon: 71.4304, lat: 51.1282 },
  SHY: { ru: 'Шымкент', kz: 'Шымкент', en: 'Shymkent', lon: 69.5901, lat: 42.3417 },
};

export const HUB_CITY = 'ALA';

export const AREAS = { ...REGIONS, ...CITIES };
