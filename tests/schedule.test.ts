import { describe, expect, it } from 'vitest';
import { defaultConfig } from '../src/lib/defaults';
import { buildMonths, buildReceipts, escalatedRent, totalRent } from '../src/lib/schedule';
import { validate } from '../src/lib/validate';
import type { Config } from '../src/lib/types';

const base = (over: Partial<Config> = {}): Config => ({
  ...defaultConfig(new Date('2026-09-30')),
  tenantName: 'Test Tenant',
  landlordName: 'Test Landlord',
  landlordPan: 'ABCDE1234F',
  propertyAddress: '12 Sample Road, Testville',
  fyStart: 2026,
  rentFrom: '2026-04-01',
  rentTo: '2027-03-31',
  baseRent: 66000,
  baseRentFrom: '2025-04-01',
  escalationPct: 10,
  ...over,
});

describe('escalation', () => {
  it('raises rent 10% on each anniversary of the base date', () => {
    const c = base();
    expect(escalatedRent(c, 2025, 4)).toBe(66000);
    expect(escalatedRent(c, 2026, 3)).toBe(66000);
    expect(escalatedRent(c, 2026, 4)).toBe(72600);
    expect(escalatedRent(c, 2027, 4)).toBe(79860);
  });
  it('never lowers rent for months before the base date', () => {
    expect(escalatedRent(base(), 2024, 1)).toBe(66000);
  });
});

describe('buildMonths', () => {
  it('gives 12 months for a full FY with correct bounds', () => {
    const m = buildMonths(base());
    expect(m).toHaveLength(12);
    expect(m[0]).toMatchObject({ key: '2026-04', periodStart: '2026-04-01', periodEnd: '2026-04-30', days: 30, amount: 72600 });
    expect(m[11]).toMatchObject({ key: '2027-03', periodEnd: '2027-03-31' });
    expect(m[10].periodEnd).toBe('2027-02-28');
    expect(totalRent(m)).toBe(72600 * 12);
  });
  it('prorates partial first and last months', () => {
    const m = buildMonths(base({ rentFrom: '2026-04-16', rentTo: '2026-05-15', baseRent: 30000, escalationPct: 0 }));
    expect(m).toHaveLength(2);
    expect(m[0]).toMatchObject({ days: 15, amount: 15000, paymentDate: '2026-04-16' });
    expect(m[1]).toMatchObject({ days: 15, amount: Math.round((30000 * 15) / 31) });
  });
  it('charges full rent for partial months when proration is off', () => {
    const m = buildMonths(base({ rentFrom: '2026-04-16', rentTo: '2026-04-30', prorate: false, escalationPct: 0 }));
    expect(m[0].amount).toBe(66000);
  });
  it('lets a hand-set month replace the computed amount', () => {
    const m = buildMonths(base({ overrides: { '2026-06': 70000 } }));
    expect(m[2]).toMatchObject({ amount: 70000, overridden: true });
  });
  it('clamps the payment day to the month length', () => {
    const m = buildMonths(base({ paymentDay: 31 }));
    expect(m[10].paymentDate).toBe('2027-02-28');
    expect(m[0].paymentDate).toBe('2026-04-30');
  });
  it('returns nothing for an inverted or invalid range', () => {
    expect(buildMonths(base({ rentFrom: '2027-01-01', rentTo: '2026-01-01' }))).toEqual([]);
    expect(buildMonths(base({ rentFrom: 'nope' }))).toEqual([]);
  });
});

describe('buildReceipts', () => {
  it('makes one receipt per month by default', () => {
    expect(buildReceipts(base())).toHaveLength(12);
  });
  it('groups quarterly, half-yearly and consolidated', () => {
    expect(buildReceipts(base({ grouping: 'quarterly' }))).toHaveLength(4);
    expect(buildReceipts(base({ grouping: 'half-yearly' }))).toHaveLength(2);
    const [one] = buildReceipts(base({ grouping: 'consolidated' }));
    expect(one).toMatchObject({ periodStart: '2026-04-01', periodEnd: '2027-03-31', amount: 72600 * 12 });
  });
  it('numbers receipts only when asked', () => {
    expect(buildReceipts(base())[0].no).toBe('');
    expect(buildReceipts(base({ numbering: true, numberPrefix: 'RR-2627-' }))[2].no).toBe('RR-2627-03');
  });
});

describe('validate', () => {
  const run = (c: Config, today = '2026-09-30') => {
    const m = buildMonths(c);
    return validate(c, m, buildReceipts(c, m), today);
  };
  it('is clean for a good profile, apart from advisory notes', () => {
    expect(run(base()).filter((i) => i.level === 'error')).toEqual([]);
  });
  it('flags a malformed PAN and missing names', () => {
    const issues = run(base({ landlordPan: 'BAD', tenantName: '' }));
    expect(issues.map((i) => i.field)).toEqual(expect.arrayContaining(['landlordPan', 'tenantName']));
  });
  it('warns about future-dated receipts', () => {
    const msg = run(base()).find((i) => i.message.includes('future'));
    expect(msg?.message).toContain('6 receipts are dated in the future');
  });
  it('warns when annual rent passes 1 lakh with no PAN', () => {
    expect(run(base({ landlordPan: '' })).some((i) => i.field === 'landlordPan' && i.level === 'warn')).toBe(true);
  });
});
