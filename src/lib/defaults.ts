import { uid } from './uid';
import { fyBounds, fyOf, isValidISO, todayISO } from './dates';
import type { Config } from './types';

export function defaultConfig(now = new Date()): Config {
  const fy = fyOf(todayISO(now));
  const { from, to } = fyBounds(fy);
  return {
    id: uid(),
    label: 'New profile',
    tenantName: '',
    landlordName: '',
    landlordPan: '',
    landlordAddress: '',
    propertyAddress: '',
    fyStart: fy,
    rentFrom: from,
    rentTo: to,
    monthlyRent: 0,
    overrides: {},
    paymentDates: {},
    paymentDay: 1,
    paymentMode: 'Online Transfer',
    grouping: 'monthly',
    perPage: 2,
    dateFormat: 'mdy',
    numbering: false,
    numberPrefix: 'RR-',
    template: 'classic',
    font: 'Helvetica',
    grayPage: false,
    showStamp: true,
    showPan: true,
    signature: '',
    title: 'RECEIPT OF HOUSE RENT',
    subtitle: '(Under Section 10(13A) of Income Tax Act)',
    footer: '',
  };
}

const ENUMS = {
  grouping: ['monthly', 'quarterly', 'half-yearly', 'consolidated'],
  dateFormat: ['mdy', 'dmy', 'long'],
  template: ['classic', 'modern', 'minimal'],
  font: ['Helvetica', 'Times', 'Courier'],
} as const;

const STRING_KEYS = [
  'label', 'tenantName', 'landlordName', 'landlordAddress', 'propertyAddress', 'paymentMode', 'numberPrefix',
  'title', 'subtitle', 'footer',
] as const;
const BOOL_KEYS = ['numbering', 'grayPage', 'showStamp', 'showPan'] as const;
const DATE_KEYS = ['rentFrom', 'rentTo'] as const;
const NUM_KEYS: Array<[keyof Config, number, number]> = [
  ['fyStart', 1990, 2100], ['monthlyRent', 0, 100_000_000], ['paymentDay', 1, 31],
];

const INT_KEYS = new Set<keyof Config>(['fyStart', 'paymentDay']);

const MAX_TEXT = 500;

/**
 * Coerces untrusted data (an imported JSON file, an old localStorage entry) into a valid Config.
 * Anything malformed falls back to the default, so a bad file can never crash the renderer.
 */
export function normalizeConfig(raw: Partial<Config> | Record<string, unknown>): Config {
  const base = defaultConfig();
  const src = (raw && typeof raw === 'object' ? { ...raw } : {}) as Record<string, unknown>;
  // Accepts `baseRent`, the field name used by earlier exports.
  if (src.monthlyRent === undefined && src.baseRent !== undefined) src.monthlyRent = src.baseRent;
  const out: Record<string, unknown> = { ...base };

  out.id = typeof src.id === 'string' && src.id ? src.id.slice(0, 64) : base.id;
  for (const k of STRING_KEYS) if (typeof src[k] === 'string') out[k] = (src[k] as string).slice(0, MAX_TEXT);
  out.landlordPan = typeof src.landlordPan === 'string' ? src.landlordPan.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10) : '';
  for (const k of BOOL_KEYS) if (typeof src[k] === 'boolean') out[k] = src[k];
  for (const k of DATE_KEYS) if (typeof src[k] === 'string' && isValidISO(src[k] as string)) out[k] = src[k];
  for (const [k, lo, hi] of NUM_KEYS) {
    const v = Number(src[k]);
    if (src[k] !== undefined && src[k] !== '' && Number.isFinite(v)) {
      out[k] = Math.min(hi, Math.max(lo, INT_KEYS.has(k) ? Math.round(v) : v));
    }
  }
  for (const [k, allowed] of Object.entries(ENUMS)) {
    if ((allowed as readonly unknown[]).includes(src[k])) out[k] = src[k];
  }
  if ([1, 2, 3, 4].includes(Number(src.perPage))) out.perPage = Number(src.perPage);
  if (typeof src.signature === 'string' && /^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=]+$/.test(src.signature)) {
    out.signature = src.signature;
  }
  const overrides: Record<string, number> = {};
  if (src.overrides && typeof src.overrides === 'object') {
    for (const [k, v] of Object.entries(src.overrides as Record<string, unknown>)) {
      const n = Number(v);
      if (/^\d{4}-(0[1-9]|1[0-2])$/.test(k) && Number.isFinite(n) && n >= 0 && n < 100_000_000) overrides[k] = Math.round(n * 100) / 100;
    }
  }
  out.overrides = overrides;
  const paymentDates: Record<string, string> = {};
  if (src.paymentDates && typeof src.paymentDates === 'object') {
    for (const [k, v] of Object.entries(src.paymentDates as Record<string, unknown>)) {
      if (/^\d{4}-(0[1-9]|1[0-2])$/.test(k) && typeof v === 'string' && isValidISO(v)) paymentDates[k] = v;
    }
  }
  out.paymentDates = paymentDates;
  return out as unknown as Config;
}
