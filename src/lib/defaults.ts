import { fyBounds, fyOf, todayISO } from './dates';
import type { Config } from './types';

export function defaultConfig(now = new Date()): Config {
  const fy = fyOf(todayISO(now));
  const { from, to } = fyBounds(fy);
  return {
    id: crypto.randomUUID(),
    label: 'New profile',
    tenantName: '',
    landlordName: '',
    landlordPan: '',
    landlordAddress: '',
    propertyAddress: '',
    fyStart: fy,
    rentFrom: from,
    rentTo: to,
    baseRent: 0,
    baseRentFrom: from,
    escalationPct: 0,
    escalationMonths: 12,
    overrides: {},
    prorate: true,
    paymentDay: 1,
    paymentMode: 'Online Transfer',
    grouping: 'monthly',
    perPage: 2,
    dateFormat: 'mdy',
    numbering: false,
    numberPrefix: 'RR-',
    template: 'classic',
    font: 'Helvetica',
    accent: '#0f766e',
    grayPage: false,
    showStamp: true,
    showPan: true,
    signature: '',
    title: 'RECEIPT OF HOUSE RENT',
    subtitle: '(Under Section 10(13A) of Income Tax Act)',
    footer: '',
  };
}

/** Fills any field an older saved profile lacks, so schema growth never breaks stored data. */
export function normalizeConfig(raw: Partial<Config>): Config {
  return { ...defaultConfig(), ...raw, overrides: { ...(raw.overrides ?? {}) } };
}
