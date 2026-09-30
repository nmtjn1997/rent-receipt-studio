import { parseArgs } from 'node:util';
import { generate, type GenerateInput } from './generate';
import { PAYMENT_MODES } from '../lib/types';
import { inr } from '../lib/words';

const HELP = `rent-receipt: make Section 10(13A) rent receipts as a PDF, no browser needed.

Required (or supply them with --profile):
  --tenant "Your Name"
  --landlord "Owner Name"
  --property "Rented house address"
  --rent 25000                     monthly rent in INR

Period (default: the current financial year):
  --fy 2026                        FY 2026-27
  --through 2026-09                stop after this month (only what you have paid so far)
  --from 2026-04-01 --to 2027-03-31   exact dates instead of a whole FY

Optional:
  --grouping monthly|quarterly|half-yearly|consolidated   (default monthly)
  --pan ABCDE1234F                 landlord PAN
  --landlord-address "..."         defaults to the property address
  --mode "Online Transfer"         ${PAYMENT_MODES.join(', ')}
  --pay-day 1                      day of month rent is paid
  --per-page 2                     receipts per page, 1 to 4
  --template classic|modern|minimal
  --font Helvetica|Times|Courier
  --date-format mdy|dmy|long
  --no-stamp                       leave out the revenue stamp line
  --profile file.json              profile exported from the web app
  --out receipts.pdf               output path (default: ./rent-receipts-<tenant>-fy<year>.pdf)
  --json                           print the result as JSON
  -h, --help

Example:
  rent-receipt --tenant "Alex Sharma" --landlord "Priya Verma" --property "Flat 4B, Lake View, Bengaluru" \\
    --rent 25000 --pan ABCDE1234F --fy 2026 --through 2026-09
`;

const num = (v: string | undefined, name: string): number | undefined => {
  if (v === undefined) return undefined;
  const n = Number(v);
  if (!Number.isFinite(n)) throw new Error(`--${name} must be a number.`);
  return n;
};

async function main() {
  const { values: v } = parseArgs({
    options: {
      tenant: { type: 'string' }, landlord: { type: 'string' }, property: { type: 'string' }, rent: { type: 'string' },
      fy: { type: 'string' }, from: { type: 'string' }, to: { type: 'string' }, through: { type: 'string' },
      grouping: { type: 'string' }, pan: { type: 'string' }, 'landlord-address': { type: 'string' }, mode: { type: 'string' },
      'pay-day': { type: 'string' }, 'per-page': { type: 'string' }, template: { type: 'string' }, font: { type: 'string' },
      'date-format': { type: 'string' }, 'no-stamp': { type: 'boolean' }, profile: { type: 'string' }, out: { type: 'string' },
      json: { type: 'boolean' }, help: { type: 'boolean', short: 'h' },
    },
    strict: true,
  });
  if (v.help) {
    console.log(HELP);
    return;
  }
  const oneOf = <T extends string>(x: string | undefined, name: string, allowed: readonly T[]): T | undefined => {
    if (x === undefined) return undefined;
    if (!(allowed as readonly string[]).includes(x)) throw new Error(`--${name} must be one of: ${allowed.join(', ')}.`);
    return x as T;
  };
  const perPage = num(v['per-page'], 'per-page');
  if (perPage !== undefined && ![1, 2, 3, 4].includes(perPage)) throw new Error('--per-page must be 1, 2, 3 or 4.');
  const input: GenerateInput = {
    tenant: v.tenant, landlord: v.landlord, property: v.property, rent: num(v.rent, 'rent'), fy: num(v.fy, 'fy'),
    from: v.from, to: v.to, through: v.through, pan: v.pan, landlordAddress: v['landlord-address'], mode: v.mode,
    payDay: num(v['pay-day'], 'pay-day'), perPage: perPage as GenerateInput['perPage'], noStamp: v['no-stamp'],
    profile: v.profile, out: v.out,
    grouping: oneOf(v.grouping, 'grouping', ['monthly', 'quarterly', 'half-yearly', 'consolidated']),
    template: oneOf(v.template, 'template', ['classic', 'modern', 'minimal']),
    font: oneOf(v.font, 'font', ['Helvetica', 'Times', 'Courier']),
    dateFormat: oneOf(v['date-format'], 'date-format', ['mdy', 'dmy', 'long']),
  };
  const r = await generate(input);
  if (v.json) {
    console.log(JSON.stringify(r, null, 2));
    return;
  }
  console.log(`${r.receipts} receipt${r.receipts === 1 ? '' : 's'} for ${r.months} month${r.months === 1 ? '' : 's'}, INR ${inr(r.total)} in total`);
  console.log(`${r.period.from} to ${r.period.to}`);
  for (const w of r.warnings) console.error(`note: ${w}`);
  console.log(r.path);
}

main().catch((e: unknown) => {
  console.error(`error: ${e instanceof Error ? e.message : String(e)}`);
  console.error('Run with --help for usage.');
  process.exit(1);
});
