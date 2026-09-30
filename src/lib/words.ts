const ONES = [
  '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven',
  'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen',
];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

function below100(n: number): string {
  if (n < 20) return ONES[n];
  return TENS[Math.floor(n / 10)] + (n % 10 ? ' ' + ONES[n % 10] : '');
}

function below1000(n: number): string {
  const h = Math.floor(n / 100);
  const r = n % 100;
  return [h ? ONES[h] + ' Hundred' : '', r ? below100(r) : ''].filter(Boolean).join(' ');
}

/** Whole number in the Indian system (thousand, lakh, crore). */
export function integerToWords(n: number): string {
  if (!Number.isInteger(n) || n < 0) throw new RangeError('integerToWords needs a non-negative integer');
  if (n === 0) return 'Zero';
  const parts: string[] = [];
  const crore = Math.floor(n / 10_000_000);
  const lakh = Math.floor((n % 10_000_000) / 100_000);
  const thousand = Math.floor((n % 100_000) / 1000);
  const rest = n % 1000;
  if (crore) parts.push(integerToWords(crore) + ' Crore');
  if (lakh) parts.push(below100(lakh) + ' Lakh');
  if (thousand) parts.push(below100(thousand) + ' Thousand');
  if (rest) parts.push(below1000(rest));
  return parts.join(' ');
}

/** "Rupees Seventy Two Thousand Six Hundred Only", with paise when present. */
export function amountToWords(amount: number): string {
  const paiseTotal = Math.round(amount * 100);
  const rupees = Math.floor(paiseTotal / 100);
  const paise = paiseTotal % 100;
  let out = 'Rupees ' + integerToWords(rupees);
  if (paise) out += ' and ' + below100(paise) + ' Paise';
  return out + ' Only';
}

/** 7260000 becomes "72,60,000" (Indian digit grouping). */
export function inr(n: number): string {
  const [int, frac] = Math.abs(n).toFixed(Number.isInteger(n) ? 0 : 2).split('.');
  let out = int.slice(-3);
  let rest = int.slice(0, -3);
  while (rest.length > 0) {
    out = rest.slice(-2) + ',' + out;
    rest = rest.slice(0, -2);
  }
  return (n < 0 ? '-' : '') + out + (frac ? '.' + frac : '');
}
