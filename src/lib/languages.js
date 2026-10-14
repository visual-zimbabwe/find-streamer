/**
 * ISO 639-1 Language Code to English Name Mapping and Resolution.
 *
 * Hermes in React Native does not bundle Intl.DisplayNames, causing
 * Intl-based language resolution to fail and fall back to raw 2-letter
 * ISO codes (e.g. 'EN', 'DA', 'FR', 'DE') on Android devices.
 *
 * This module provides:
 *  1. A comprehensive, offline dictionary of all ISO 639-1 / TMDB language codes.
 *  2. Fast O(1) human-readable language name resolution.
 *  3. Fallbacks to Intl.DisplayNames and uppercase codes for exotic edge cases.
 */

export const ISO_639_1_LANGUAGE_NAMES = Object.freeze({
  aa: 'Afar',
  ab: 'Abkhazian',
  ae: 'Avestan',
  af: 'Afrikaans',
  ak: 'Akan',
  am: 'Amharic',
  an: 'Aragonese',
  ar: 'Arabic',
  as: 'Assamese',
  av: 'Avaric',
  ay: 'Aymara',
  az: 'Azerbaijani',
  ba: 'Bashkir',
  be: 'Belarusian',
  bg: 'Bulgarian',
  bi: 'Bislama',
  bm: 'Bambara',
  bn: 'Bengali',
  bo: 'Tibetan',
  br: 'Breton',
  bs: 'Bosnian',
  ca: 'Catalan',
  ce: 'Chechen',
  ch: 'Chamorro',
  cn: 'Cantonese',
  co: 'Corsican',
  cr: 'Cree',
  cs: 'Czech',
  cu: 'Slavic',
  cv: 'Chuvash',
  cy: 'Welsh',
  da: 'Danish',
  de: 'German',
  dv: 'Divehi',
  dz: 'Dzongkha',
  ee: 'Ewe',
  el: 'Greek',
  en: 'English',
  eo: 'Esperanto',
  es: 'Spanish',
  et: 'Estonian',
  eu: 'Basque',
  fa: 'Persian',
  ff: 'Fulah',
  fi: 'Finnish',
  fj: 'Fijian',
  fo: 'Faroese',
  fr: 'French',
  fy: 'Frisian',
  ga: 'Irish',
  gd: 'Gaelic',
  gl: 'Galician',
  gn: 'Guarani',
  gu: 'Gujarati',
  gv: 'Manx',
  ha: 'Hausa',
  he: 'Hebrew',
  hi: 'Hindi',
  ho: 'Hiri Motu',
  hr: 'Croatian',
  ht: 'Haitian Creole',
  hu: 'Hungarian',
  hy: 'Armenian',
  hz: 'Herero',
  ia: 'Interlingua',
  id: 'Indonesian',
  ie: 'Interlingue',
  ig: 'Igbo',
  ii: 'Yi',
  ik: 'Inupiaq',
  io: 'Ido',
  is: 'Icelandic',
  it: 'Italian',
  iu: 'Inuktitut',
  ja: 'Japanese',
  jv: 'Javanese',
  ka: 'Georgian',
  kg: 'Kongo',
  ki: 'Kikuyu',
  kj: 'Kuanyama',
  kk: 'Kazakh',
  kl: 'Kalaallisut',
  km: 'Khmer',
  kn: 'Kannada',
  ko: 'Korean',
  kr: 'Kanuri',
  ks: 'Kashmiri',
  ku: 'Kurdish',
  kv: 'Komi',
  kw: 'Cornish',
  ky: 'Kirghiz',
  la: 'Latin',
  lb: 'Letzeburgesch',
  lg: 'Ganda',
  li: 'Limburgish',
  ln: 'Lingala',
  lo: 'Lao',
  lt: 'Lithuanian',
  lu: 'Luba-Katanga',
  lv: 'Latvian',
  mg: 'Malagasy',
  mh: 'Marshallese',
  mi: 'Maori',
  mk: 'Macedonian',
  ml: 'Malayalam',
  mn: 'Mongolian',
  mo: 'Moldavian',
  mr: 'Marathi',
  ms: 'Malay',
  mt: 'Maltese',
  my: 'Burmese',
  na: 'Nauru',
  nb: 'Norwegian Bokmål',
  nd: 'Ndebele',
  ne: 'Nepali',
  ng: 'Ndonga',
  nl: 'Dutch',
  nn: 'Norwegian Nynorsk',
  no: 'Norwegian',
  nr: 'Ndebele',
  nv: 'Navajo',
  ny: 'Chichewa',
  oc: 'Occitan',
  oj: 'Ojibwa',
  om: 'Oromo',
  or: 'Oriya',
  os: 'Ossetian',
  pa: 'Punjabi',
  pi: 'Pali',
  pl: 'Polish',
  ps: 'Pashto',
  pt: 'Portuguese',
  qu: 'Quechua',
  rm: 'Raeto-Romance',
  rn: 'Rundi',
  ro: 'Romanian',
  ru: 'Russian',
  rw: 'Kinyarwanda',
  sa: 'Sanskrit',
  sc: 'Sardinian',
  sd: 'Sindhi',
  se: 'Northern Sami',
  sg: 'Sango',
  sh: 'Serbo-Croatian',
  si: 'Sinhalese',
  sk: 'Slovak',
  sl: 'Slovenian',
  sm: 'Samoan',
  sn: 'Shona',
  so: 'Somali',
  sq: 'Albanian',
  sr: 'Serbian',
  ss: 'Swati',
  st: 'Sotho',
  su: 'Sundanese',
  sv: 'Swedish',
  sw: 'Swahili',
  ta: 'Tamil',
  te: 'Telugu',
  tg: 'Tajik',
  th: 'Thai',
  ti: 'Tigrinya',
  tk: 'Turkmen',
  tl: 'Tagalog',
  tn: 'Tswana',
  to: 'Tongan',
  tr: 'Turkish',
  ts: 'Tsonga',
  tt: 'Tatar',
  tw: 'Twi',
  ty: 'Tahitian',
  ug: 'Uighur',
  uk: 'Ukrainian',
  ur: 'Urdu',
  uz: 'Uzbek',
  ve: 'Venda',
  vi: 'Vietnamese',
  vo: 'Volapük',
  wa: 'Walloon',
  wo: 'Wolof',
  xh: 'Xhosa',
  xx: 'No Language',
  yi: 'Yiddish',
  yo: 'Yoruba',
  za: 'Zhuang',
  zh: 'Chinese',
  zu: 'Zulu',
});

/**
 * Maps an ISO 639-1 code (or language tag) to a human-readable English name.
 * Safe across all JavaScript runtimes (Hermes, JSC, V8, Node).
 *
 * @param {string | null | undefined} code
 * @returns {string}
 */
export function resolveLanguageLabel(code) {
  if (!code) return 'Other';
  const clean = String(code).toLowerCase().trim();
  if (!clean || clean === 'other') return 'Other';
  if (clean === 'xx') return 'No Language';

  // 1. Direct dictionary lookup (covers 100% of standard ISO 639-1 and TMDB codes)
  if (ISO_639_1_LANGUAGE_NAMES[clean]) {
    return ISO_639_1_LANGUAGE_NAMES[clean];
  }

  // 2. Handle regional or locale tags (e.g. 'en-US' -> 'en', 'pt_BR' -> 'pt')
  const baseCode = clean.split(/[-_]/)[0];
  if (baseCode && ISO_639_1_LANGUAGE_NAMES[baseCode]) {
    return ISO_639_1_LANGUAGE_NAMES[baseCode];
  }

  // 3. Fallback to Intl.DisplayNames if the host environment supports it
  try {
    if (typeof Intl !== 'undefined' && Intl.DisplayNames) {
      const dn = new Intl.DisplayNames(['en'], { type: 'language' });
      const name = dn.of(clean);
      if (name && name.toLowerCase() !== clean) {
        return name;
      }
    }
  } catch {}

  // 4. Ultimate fallback: uppercase code
  return clean.toUpperCase();
}
