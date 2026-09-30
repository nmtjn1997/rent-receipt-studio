import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { defaultConfig, normalizeConfig } from '../lib/defaults';
import { daysInMonth, fyBounds, fyLabel, fyOf, isValidISO, toISO, todayISO } from '../lib/dates';
import { generatePdf } from '../lib/pdf';
import { buildMonths, buildReceipts, totalRent } from '../lib/schedule';
import type { Config, DateFormat, FontFamily, Grouping, TemplateId } from '../lib/types';
import { validate } from '../lib/validate';

/** Everything a caller may set. Only tenant, landlord, property and rent are needed (a profile can supply them). */
export interface GenerateInput {
  tenant?: string;
  landlord?: string;
  property?: string;
  rent?: number;
  /** Financial year start, 2026 means FY 2026-27. Defaults to the current FY. */
  fy?: number;
  from?: string;
  to?: string;
  /** Last month to include as YYYY-MM, for "only what I have paid so far". */
  through?: string;
  grouping?: Grouping;
  mode?: string;
  pan?: string;
  landlordAddress?: string;
  payDay?: number;
  perPage?: 1 | 2 | 3 | 4;
  template?: TemplateId;
  font?: FontFamily;
  dateFormat?: DateFormat;
  noStamp?: boolean;
  /** Path to a profile JSON exported from the web app (an array uses its first entry). */
  profile?: string;
  out?: string;
}

export interface GenerateResult {
  path: string;
  receipts: number;
  months: number;
  total: number;
  period: { from: string; to: string };
  warnings: string[];
}

const slug = (s: string) => s.trim().replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() || 'rent';

export function buildConfig(input: GenerateInput, now = new Date()): Config {
  let base: Partial<Config> = {};
  if (input.profile) {
    const raw = JSON.parse(readFileSync(resolve(input.profile), 'utf8')) as unknown;
    const first = Array.isArray(raw) ? raw[0] : raw;
    if (!first || typeof first !== 'object') throw new Error(`Profile ${input.profile} has no profile object.`);
    base = first as Partial<Config>;
  }
  const set: Partial<Config> = {};
  if (input.tenant !== undefined) set.tenantName = input.tenant;
  if (input.landlord !== undefined) set.landlordName = input.landlord;
  if (input.property !== undefined) set.propertyAddress = input.property;
  if (input.rent !== undefined) set.monthlyRent = input.rent;
  if (input.pan !== undefined) set.landlordPan = input.pan;
  if (input.landlordAddress !== undefined) set.landlordAddress = input.landlordAddress;
  if (input.mode !== undefined) set.paymentMode = input.mode;
  if (input.payDay !== undefined) set.paymentDay = input.payDay;
  if (input.grouping) set.grouping = input.grouping;
  if (input.perPage) set.perPage = input.perPage;
  if (input.template) set.template = input.template;
  if (input.font) set.font = input.font;
  if (input.dateFormat) set.dateFormat = input.dateFormat;
  if (input.noStamp) set.showStamp = false;

  const fy = input.fy ?? (input.from && isValidISO(input.from) ? fyOf(input.from) : fyOf(todayISO(now)));
  const bounds = fyBounds(fy);
  let rentFrom = input.from ?? bounds.from;
  let rentTo = input.to ?? bounds.to;
  if (input.through) {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(input.through)) throw new Error('--through must look like 2026-09 (YYYY-MM).');
    const [y, m] = input.through.split('-').map(Number);
    const end = toISO(y, m, daysInMonth(y, m));
    if (end < rentTo) rentTo = end;
  }
  return normalizeConfig({ ...defaultConfig(now), ...base, ...set, fyStart: fy, rentFrom, rentTo, id: 'cli' });
}

export async function generate(input: GenerateInput, now = new Date()): Promise<GenerateResult> {
  const cfg = buildConfig(input, now);
  const months = buildMonths(cfg);
  const receipts = buildReceipts(cfg, months);
  const issues = validate(cfg, months, receipts, todayISO(now));
  const errors = issues.filter((i) => i.level === 'error').map((i) => i.message);
  if (errors.length || !receipts.length) {
    throw new Error(errors.length ? errors.join('\n') : 'Nothing to generate for that period.');
  }
  const bytes = await generatePdf(cfg, receipts);
  const name = `rent-receipts-${slug(cfg.tenantName)}-fy${fyLabel(fyOf(cfg.rentFrom))}.pdf`;
  const path = resolve(input.out ?? name);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, bytes);
  return {
    path,
    receipts: receipts.length,
    months: months.length,
    total: totalRent(months),
    period: { from: cfg.rentFrom, to: cfg.rentTo },
    warnings: issues.filter((i) => i.level !== 'error').map((i) => i.message),
  };
}
