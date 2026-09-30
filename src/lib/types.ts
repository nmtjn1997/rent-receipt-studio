export type Grouping = 'monthly' | 'quarterly' | 'half-yearly' | 'consolidated';
export type DateFormat = 'mdy' | 'dmy' | 'long';
export type TemplateId = 'classic' | 'modern' | 'minimal';
export type FontFamily = 'Helvetica' | 'Times' | 'Courier';

export const PAYMENT_MODES = ['Online Transfer', 'UPI', 'NEFT', 'IMPS', 'Cheque', 'Cash'] as const;

export interface Config {
  id: string;
  label: string;
  tenantName: string;
  landlordName: string;
  landlordPan: string;
  landlordAddress: string;
  propertyAddress: string;
  /** FY start year: 2026 means FY 2026-27 (Apr 2026 to Mar 2027). */
  fyStart: number;
  rentFrom: string;
  rentTo: string;
  /** Rent in force from `baseRentFrom`; later months escalate from it. */
  baseRent: number;
  baseRentFrom: string;
  escalationPct: number;
  escalationMonths: number;
  /** 'YYYY-MM' to exact month amount, set by hand in the schedule table. */
  overrides: Record<string, number>;
  /** 'YYYY-MM' to an exact payment date, for months paid on a different day. */
  paymentDates: Record<string, string>;
  prorate: boolean;
  paymentDay: number;
  paymentMode: string;
  grouping: Grouping;
  perPage: 1 | 2 | 3 | 4;
  dateFormat: DateFormat;
  numbering: boolean;
  numberPrefix: string;
  template: TemplateId;
  font: FontFamily;
  accent: string;
  grayPage: boolean;
  showStamp: boolean;
  showPan: boolean;
  /** PNG or JPEG data URL of the owner's signature, optional. */
  signature: string;
  title: string;
  subtitle: string;
  footer: string;
}

export interface MonthRow {
  key: string;
  monthStart: string;
  periodStart: string;
  periodEnd: string;
  days: number;
  monthDays: number;
  /** Full-month rent after escalation or override. */
  rent: number;
  /** Amount for the covered days (prorated when the month is partial). */
  amount: number;
  paymentDate: string;
  overridden: boolean;
  paymentDateOverridden: boolean;
}

export interface Receipt {
  no: string;
  periodStart: string;
  periodEnd: string;
  paymentDate: string;
  amount: number;
  months: MonthRow[];
}
