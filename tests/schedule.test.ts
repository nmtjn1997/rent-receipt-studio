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

describe('normalizeConfig (untrusted input)', () => {
  it('repairs hostile or malformed imports instead of crashing', async () => {
    const { normalizeConfig } = await import('../src/lib/defaults');
    const c = normalizeConfig({
      perPage: 9, template: 'evil', font: 42, grouping: null, accent: 'red', baseRent: 'abc', escalationPct: 5000,
      rentFrom: 'nope', landlordPan: 'ab-cde 1234f!!', signature: 'javascript:alert(1)',
      overrides: { '2026-04': 5, 'bad': 1, '2026-13': 2, '2026-05': -3, '2026-06': 'x' },
      tenantName: 'x'.repeat(5000),
    } as never);
    expect(c.perPage).toBe(2);
    expect(c.template).toBe('classic');
    expect(c.font).toBe('Helvetica');
    expect(c.grouping).toBe('monthly');
    expect(c.accent).toBe('#0f766e');
    expect(c.baseRent).toBe(0);
    expect(c.escalationPct).toBe(100);
    expect(c.landlordPan).toBe('ABCDE1234F');
    expect(c.signature).toBe('');
    expect(c.overrides).toEqual({ '2026-04': 5 });
    expect(c.tenantName).toHaveLength(500);
    expect(c.rentFrom).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
  it('survives non-object input', async () => {
    const { normalizeConfig } = await import('../src/lib/defaults');
    expect(normalizeConfig(null as never).perPage).toBe(2);
    expect(normalizeConfig('x' as never).template).toBe('classic');
  });
  it('keeps a valid profile unchanged', async () => {
    const { normalizeConfig } = await import('../src/lib/defaults');
    const c = base({ overrides: { '2026-06': 70000 }, template: 'modern', perPage: 3 });
    expect(normalizeConfig(c)).toEqual(c);
  });
});

describe('limits', () => {
  it('rejects ranges longer than 60 months', () => {
    const c = base({ rentFrom: '2020-04-01', rentTo: '2030-03-31' });
    const m = buildMonths(c);
    expect(validate(c, m, buildReceipts(c, m), '2026-09-30').some((i) => i.message.includes('at most 60'))).toBe(true);
  });
  it('never builds an unbounded schedule', () => {
    expect(buildMonths(base({ rentFrom: '2000-01-01', rentTo: '2100-12-31' })).length).toBeLessThanOrEqual(122);
  });
});

describe('review regressions', () => {
  const run = (c: Config) => {
    const m = buildMonths(c);
    return { m, issues: validate(c, m, buildReceipts(c, m), '2026-09-30') };
  };
  it('a blank rent-in-force date neither yields NaN nor passes validation', () => {
    const { m, issues } = run(base({ baseRentFrom: '' }));
    expect(m.every((r) => Number.isFinite(r.amount))).toBe(true);
    expect(issues.some((i) => i.field === 'baseRentFrom' && i.level === 'error')).toBe(true);
  });
  it('blocks zero-amount months and absurd escalations', () => {
    expect(run(base({ overrides: { '2026-04': 0 } })).issues.some((i) => i.level === 'error')).toBe(true);
    const wild = run(base({ escalationPct: 100, escalationMonths: 1, rentFrom: '2026-04-01', rentTo: '2030-03-31' }));
    expect(wild.issues.some((i) => i.message.includes('10,00,00,000'))).toBe(true);
  });
  it('flags cash stamps on the receipt total, not each month', () => {
    const c = base({ paymentMode: 'Cash', baseRent: 2000, baseRentFrom: '2026-04-01', escalationPct: 0, grouping: 'quarterly' });
    expect(run(c).issues.some((i) => i.message.includes('revenue stamp'))).toBe(true);
  });
  it('uses the 2% TDS note above 50,000 a month only', () => {
    const at = run(base({ baseRent: 50000, baseRentFrom: '2026-04-01', escalationPct: 0 }));
    expect(at.issues.some((i) => i.message.includes('194-IB'))).toBe(false);
    expect(run(base()).issues.find((i) => i.message.includes('194-IB'))?.message).toContain('2%');
  });
});
