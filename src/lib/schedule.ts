import { daysInMonth, isValidISO, parseISO, toISO } from './dates';
import type { Config, MonthRow, Receipt } from './types';

const GROUP_SIZE = { monthly: 1, quarterly: 3, 'half-yearly': 6, consolidated: Infinity } as const;

export function escalatedRent(cfg: Pick<Config, 'baseRent' | 'baseRentFrom' | 'escalationPct' | 'escalationMonths'>, y: number, m: number): number {
  const base = parseISO(cfg.baseRentFrom);
  const elapsed = Math.max(0, (y - base.y) * 12 + (m - base.m));
  const every = Math.max(1, cfg.escalationMonths || 12);
  const steps = Math.floor(elapsed / every);
  return Math.round(cfg.baseRent * Math.pow(1 + cfg.escalationPct / 100, steps));
}

export function buildMonths(cfg: Config): MonthRow[] {
  if (!isValidISO(cfg.rentFrom) || !isValidISO(cfg.rentTo) || cfg.rentFrom > cfg.rentTo) return [];
  const from = parseISO(cfg.rentFrom);
  const to = parseISO(cfg.rentTo);
  const rows: MonthRow[] = [];
  let y = from.y;
  let m = from.m;
  // A hard stop well above the validated limit, so a mistyped year cannot freeze the tab.
  while ((y < to.y || (y === to.y && m <= to.m)) && rows.length <= 121) {
    const dim = daysInMonth(y, m);
    const monthStart = toISO(y, m, 1);
    const monthEnd = toISO(y, m, dim);
    const periodStart = cfg.rentFrom > monthStart ? cfg.rentFrom : monthStart;
    const periodEnd = cfg.rentTo < monthEnd ? cfg.rentTo : monthEnd;
    const days = parseISO(periodEnd).d - parseISO(periodStart).d + 1;
    const key = monthStart.slice(0, 7);
    const overridden = cfg.overrides[key] !== undefined;
    const rent = overridden ? cfg.overrides[key] : escalatedRent(cfg, y, m);
    const partial = days < dim;
    const amount = overridden || !partial || !cfg.prorate ? rent : Math.round((rent * days) / dim);
    const due = toISO(y, m, Math.min(Math.max(1, cfg.paymentDay), dim));
    const paymentDate = due < periodStart ? periodStart : due;
    rows.push({ key, monthStart, periodStart, periodEnd, days, monthDays: dim, rent, amount, paymentDate, overridden });
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  return rows;
}

export function buildReceipts(cfg: Config, months: MonthRow[] = buildMonths(cfg)): Receipt[] {
  const size = GROUP_SIZE[cfg.grouping];
  const receipts: Receipt[] = [];
  for (let i = 0; i < months.length; i += Math.min(size, months.length)) {
    const chunk = months.slice(i, i + size);
    receipts.push({
      no: '',
      periodStart: chunk[0].periodStart,
      periodEnd: chunk[chunk.length - 1].periodEnd,
      paymentDate: chunk[0].paymentDate,
      amount: chunk.reduce((sum, r) => sum + r.amount, 0),
      months: chunk,
    });
  }
  receipts.forEach((r, idx) => {
    r.no = cfg.numbering ? `${cfg.numberPrefix}${String(idx + 1).padStart(2, '0')}` : '';
  });
  return receipts;
}

export function totalRent(months: MonthRow[]): number {
  return months.reduce((sum, r) => sum + r.amount, 0);
}
