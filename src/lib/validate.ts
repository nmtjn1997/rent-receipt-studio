import { isValidISO, parseISO, todayISO } from './dates';
import type { Config, MonthRow, Receipt } from './types';
import { totalRent } from './schedule';

export interface Issue {
  level: 'error' | 'warn' | 'info';
  field?: string;
  message: string;
}

export const MAX_MONTHS = 60;
export const MAX_RENT = 100_000_000;
export const PAN_RE = /^[A-Z]{5}[0-9]{4}[A-Z]$/;

export function validate(cfg: Config, months: MonthRow[], receipts: Receipt[], today = todayISO()): Issue[] {
  const out: Issue[] = [];
  const req = (v: string, field: string, label: string) => {
    if (!v.trim()) out.push({ level: 'error', field, message: `${label} is required.` });
  };
  req(cfg.tenantName, 'tenantName', 'Your name');
  req(cfg.landlordName, 'landlordName', "Landlord's name");
  req(cfg.propertyAddress, 'propertyAddress', 'Property address');

  if (!isValidISO(cfg.rentFrom) || !isValidISO(cfg.rentTo)) {
    out.push({ level: 'error', field: 'rentFrom', message: 'Pick a valid rent period.' });
  } else if (cfg.rentFrom > cfg.rentTo) {
    out.push({ level: 'error', field: 'rentFrom', message: '"Rent from" is after "Rent upto".' });
  }
  if (months.length > MAX_MONTHS) {
    out.push({ level: 'error', field: 'rentFrom', message: `Pick at most ${MAX_MONTHS} months at a time.` });
  }
  if (!(cfg.monthlyRent > 0)) out.push({ level: 'error', field: 'monthlyRent', message: 'Monthly rent must be above zero.' });

  if (months.some((m) => !Number.isFinite(m.amount) || m.amount <= 0)) {
    out.push({ level: 'error', field: 'monthlyRent', message: 'Every month needs a rent above zero. Reset or fix the highlighted month.' });
  } else if (months.some((m) => m.amount > MAX_RENT)) {
    out.push({ level: 'error', field: 'monthlyRent', message: 'A month works out above INR 10,00,00,000. Check the rent.' });
  }

  if (receipts.some((r) => Math.abs(parseISO(r.paymentDate).y - parseISO(r.periodStart).y) > 1)) {
    out.push({ level: 'error', message: 'A payment date is more than a year away from its rent period. Check the year.' });
  }

  const annual = months.length ? totalRent(months) : 0;
  const pan = cfg.landlordPan.trim().toUpperCase();
  if (pan && !PAN_RE.test(pan)) {
    out.push({ level: 'error', field: 'landlordPan', message: 'PAN should look like ABCDE1234F.' });
  } else if (!pan && annual > 100_000) {
    out.push({
      level: 'warn',
      field: 'landlordPan',
      message: 'Total rent is above INR 1,00,000 in this period. Landlord PAN is needed for HRA proof.',
    });
  }

  const future = receipts.filter((r) => r.paymentDate > today).length;
  if (future > 0) {
    out.push({
      level: 'warn',
      message: `${future} receipt${future > 1 ? 's are' : ' is'} dated in the future. Issue a receipt only for rent actually paid.`,
    });
  }
  if (cfg.paymentMode === 'Cash' && receipts.some((r) => r.amount > 5000)) {
    out.push({ level: 'info', message: 'Cash rent above INR 5,000 needs a Re.1 revenue stamp. Keep the stamp option on.' });
  }
  if (months.some((m) => m.rent > 50_000)) {
    out.push({
      level: 'info',
      message: 'Rent above INR 50,000 a month: an individual tenant deducts TDS at 2% under Section 194-IB (confirm the current rate). It does not change the receipt.',
    });
  }
  return out;
}
