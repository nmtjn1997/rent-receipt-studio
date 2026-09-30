import { describe, expect, it } from 'vitest';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { defaultConfig } from '../src/lib/defaults';
import { generatePdf, receiptBody } from '../src/lib/pdf';
import { buildReceipts } from '../src/lib/schedule';
import type { Config } from '../src/lib/types';
import { JPEG_B64, PNG_B64 } from './fixtures';

const cfg = (over: Partial<Config> = {}): Config => ({
  ...defaultConfig(new Date('2026-09-30')),
  tenantName: 'Test Tenant',
  landlordName: 'test landlord',
  landlordPan: 'ABCDE1234F',
  landlordAddress: '12 SAMPLE ROAD, SAMPLE NAGAR',
  propertyAddress: '12 SAMPLE ROAD, SAMPLE NAGAR\nNEAR SAMPLE TEMPLE',
  fyStart: 2026,
  rentFrom: '2026-04-01',
  rentTo: '2027-03-31',
  monthlyRent: 33333,
  ...over,
});

async function extract(bytes: Uint8Array) {
  const doc = await getDocument({ data: bytes, useSystemFonts: true }).promise;
  const pages: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const tc = await (await doc.getPage(i)).getTextContent();
    pages.push(tc.items.map((it) => ('str' in it ? it.str : '')).join(' ').replace(/\s+/g, ' '));
  }
  return { numPages: doc.numPages, pages, text: pages.join(' ') };
}

describe('generatePdf', () => {
  it('lays a full FY out as 6 pages of 2 receipts, like the reference tool', async () => {
    const c = cfg();
    const { numPages, text } = await extract(await generatePdf(c, buildReceipts(c)));
    expect(numPages).toBe(6);
    expect(text.match(/RECEIPT OF HOUSE RENT/g)).toHaveLength(12);
    expect(text).toContain('Thirty Three Thousand Three Hundred Thirty Three Only');
    expect(text).toContain('Apr 1, 2026');
    expect(text).toContain('Mar 31, 2027');
    expect(text).toContain('ABCDE1234F');
  });
  it('sets owner and amount values in bold', async () => {
    const c = cfg();
    const doc = await getDocument({ data: await generatePdf(c, buildReceipts(c)), useSystemFonts: true }).promise;
    const items = (await (await doc.getPage(1)).getTextContent()).items.filter((i) => 'str' in i);
    const fontOf = (needle: string) => items.find((i) => 'str' in i && i.str.includes(needle)) as { fontName: string };
    expect(fontOf('INR 33,333/-').fontName).not.toBe(fontOf('Received a sum').fontName);
    expect(fontOf('test landlord').fontName).toBe(fontOf('INR 33,333/-').fontName);
  });
  it('carries no watermark or vendor line', async () => {
    const c = cfg();
    const { text } = await extract(await generatePdf(c, buildReceipts(c)));
    expect(text.toLowerCase()).not.toContain('scripbox');
    expect(text.toLowerCase()).not.toContain('generated using');
  });
  it('honours perPage', async () => {
    for (const [per, pages] of [[1, 12], [3, 4], [4, 3]] as const) {
      const c = cfg({ perPage: per });
      expect((await extract(await generatePdf(c, buildReceipts(c)))).numPages).toBe(pages);
    }
  });
  it('writes one consolidated receipt for the whole year', async () => {
    const c = cfg({ grouping: 'consolidated' });
    const { numPages, text } = await extract(await generatePdf(c, buildReceipts(c)));
    expect(numPages).toBe(1);
    expect(text).toContain('INR 3,99,996/-');
    expect(text).toContain('Three Lakh Ninety Nine Thousand Nine Hundred Ninety Six');
  });
  it('renders every template and font without throwing', async () => {
    for (const template of ['classic', 'modern', 'minimal'] as const) {
      for (const font of ['Helvetica', 'Times', 'Courier'] as const) {
        const c = cfg({ template, font, numbering: true, footer: 'Computer generated', grayPage: true });
        expect((await generatePdf(c, buildReceipts(c))).byteLength).toBeGreaterThan(2000);
      }
    }
  });
  it('survives characters the standard fonts cannot encode', async () => {
    const c = cfg({ propertyAddress: 'हिंदी पता, Testville ₹', footer: 'नमस्ते' });
    const { text } = await extract(await generatePdf(c, buildReceipts(c)));
    expect(text).toContain('Testville INR');
  });
  it('omits the stamp and PAN lines when switched off', async () => {
    const c = cfg({ showStamp: false, showPan: false });
    const { text } = await extract(await generatePdf(c, buildReceipts(c)));
    expect(text).not.toContain('Revenue Stamp');
    expect(text).not.toContain('ABCDE1234F');
  });
  it('produces a valid empty-safe document when there are no receipts', async () => {
    const c = cfg({ rentFrom: '2027-01-01', rentTo: '2026-01-01' });
    expect((await extract(await generatePdf(c, []))).numPages).toBe(1);
  });
});

describe('layout safety', () => {
  const LONG = 'Flat 12B, Some Very Long Building Name Apartments, Block C, Sector 21, Some Locality Extension, Some Big City, State 400001';

  async function items(bytes: Uint8Array) {
    const doc = await getDocument({ data: bytes, useSystemFonts: true }).promise;
    const out: Array<{ page: number; str: string; x: number; y: number; w: number }> = [];
    for (let p = 1; p <= doc.numPages; p++) {
      for (const it of (await (await doc.getPage(p)).getTextContent()).items) {
        if ('str' in it && it.str.trim()) out.push({ page: p, str: it.str, x: it.transform[4], y: it.transform[5], w: it.width });
      }
    }
    return out;
  }

  it('keeps every receipt inside its own slot, even with long quarterly text at 3 and 4 per page', async () => {
    for (const perPage of [3, 4] as const) {
      const c = cfg({ perPage, grouping: 'quarterly', propertyAddress: LONG, landlordAddress: LONG, footer: 'Computer generated', numbering: true });
      const all = await items(await generatePdf(c, buildReceipts(c)));
      const slotH = (841.89 - 92) / perPage;
      const slotOf = (y: number) => Math.floor((841.89 - 46 - y) / slotH);
      const byPage = (pg: number) => all.filter((i) => i.page === pg);
      for (const pg of new Set(all.map((i) => i.page))) {
        const titles = byPage(pg).filter((i) => i.str.includes('RECEIPT OF HOUSE RENT')).sort((a, b) => b.y - a.y);
        const dates = byPage(pg).filter((i) => i.str.startsWith('Date:')).sort((a, b) => b.y - a.y);
        expect(dates).toHaveLength(titles.length);
        titles.forEach((t, k) => expect(slotOf(dates[k].y)).toBe(slotOf(t.y)));
      }
    }
  });

  it('never draws past the right page edge, even for an unbroken 150-character token', async () => {
    const c = cfg({ tenantName: 'T'.repeat(120), propertyAddress: 'A'.repeat(150), landlordAddress: 'B'.repeat(150) });
    const all = await items(await generatePdf(c, buildReceipts(c)));
    expect(Math.max(...all.map((i) => i.x + i.w))).toBeLessThanOrEqual(595.28 - 40);
  });

  it('shrinks the font for long content and leaves short content at the base size', async () => {
    const sizeOf = async (over: Partial<Config>) => {
      const c = cfg({ perPage: 4, ...over });
      const doc = await getDocument({ data: await generatePdf(c, buildReceipts(c)), useSystemFonts: true }).promise;
      const t = (await (await doc.getPage(1)).getTextContent()).items.find((i) => 'str' in i && i.str.includes('Received a sum'));
      return t && 'transform' in t ? t.transform[0] : 0;
    };
    expect(await sizeOf({ propertyAddress: '12 Sample Road', landlordAddress: '12 Sample Road' })).toBeCloseTo(9, 1);
    expect(await sizeOf({ grouping: 'quarterly', propertyAddress: LONG, landlordAddress: LONG })).toBeLessThan(9);
  });
});

describe('signature images', () => {
  const embedded = async (dataUrl: string) => {
    const c = cfg({ signature: dataUrl });
    const bytes = await generatePdf(c, buildReceipts(c));
    return (Buffer.from(bytes).toString('latin1').match(/\/Subtype \/Image/g) ?? []).length;
  };
  it('embeds by content, so a JPEG labelled png still works', async () => {
    expect(await embedded('data:image/png;base64,' + JPEG_B64)).toBeGreaterThan(0);
    expect(await embedded('data:image/jpeg;base64,' + PNG_B64)).toBeGreaterThan(0);
  });
  it('reports an unreadable image instead of silently dropping it', async () => {
    const c = cfg({ signature: 'data:image/png;base64,' + Buffer.from('not an image').toString('base64') });
    await expect(generatePdf(c, buildReceipts(c))).rejects.toThrow(/signature image could not be read/);
  });
});

describe('receipt wording', () => {
  const body = (c: Config, i = 0) => {
    const r = buildReceipts(c)[i];
    return receiptBody(c, r).map((s) => s.t).join('');
  };
  it('states a per-month rate only when the amount really is that rate times months', () => {
    expect(body(cfg())).toContain('@ INR 33,333 per month');
    const partial = cfg({ monthlyRent: 30000, rentFrom: '2026-04-16', grouping: 'consolidated' });
    const text = body(partial);
    expect(text).not.toContain('per month');
    expect(text).toContain('Month-wise: Apr 2026 INR 15,000; May 2026 INR 30,000');
    expect(text).toContain('INR 3,45,000/-');
  });
  it('lists each month when rent changes inside a grouped receipt', () => {
    const c = cfg({ monthlyRent: 20000, overrides: { '2026-07': 22000, '2026-08': 22000, '2026-09': 22000 }, grouping: 'half-yearly' });
    expect(body(c)).toMatch(/Month-wise: Apr 2026 INR 20,000;.*Jul 2026 INR 22,000/);
  });
  it('uses the first month payment date on grouped receipts and says so in the date line', () => {
    const c = cfg({ grouping: 'quarterly', paymentDates: { '2026-05': '2026-05-09' } });
    expect(body(c)).toContain('on (payment date) Apr 1, 2026');
  });
});

describe('overlong text', () => {
  it('fails loudly, not silently, when text cannot fit the slot', async () => {
    const huge = 'word '.repeat(90);
    const c = cfg({ perPage: 4, grouping: 'quarterly', propertyAddress: huge, landlordAddress: huge });
    await expect(generatePdf(c, buildReceipts(c))).rejects.toThrow(/too long to fit 4 receipts per page/);
  });
});

describe('owner address', () => {
  const owner = async (over: Partial<Config>) => {
    const c = cfg({ perPage: 1, ...over });
    const doc = await getDocument({ data: await generatePdf(c, buildReceipts(c)), useSystemFonts: true }).promise;
    const text = (await (await doc.getPage(1)).getTextContent()).items.map((i) => ('str' in i ? i.str : '')).join(' ');
    return text.replace(/\s+/g, ' ');
  };
  it('prints the property address as the owner address when none is given', async () => {
    const text = await owner({ landlordAddress: '', propertyAddress: '7 Home Street, Homeville' });
    expect(text).toMatch(/Address: 7 Home Street, Homeville/);
  });
  it('prefers an explicit owner address', async () => {
    const text = await owner({ landlordAddress: '99 Other Road, Elsewhere', propertyAddress: '7 Home Street, Homeville' });
    expect(text).toMatch(/Address: 99 Other Road, Elsewhere/);
  });
});

describe('spacing follows the reference receipt', () => {
  it('leaves clear gaps after the sub-title and before the owner block, tighter at 4 per page', async () => {
    const ys = async (perPage: 1 | 2 | 4) => {
      const c = cfg({ perPage });
      const doc = await getDocument({ data: await generatePdf(c, buildReceipts(c)), useSystemFonts: true }).promise;
      const it = (await (await doc.getPage(1)).getTextContent()).items.filter((i) => 'str' in i && i.str.trim());
      const y = (needle: string) => (it.find((i) => 'str' in i && i.str.includes(needle)) as { transform: number[] }).transform[5];
      const size = (needle: string) => (it.find((i) => 'str' in i && i.str.includes(needle)) as { transform: number[] }).transform[0];
      return { subToBody: y('Under Section') - y('Received a sum'), size: size('Received a sum'), ownerToPan: y('Name of Owner') - y('PAN:') };
    };
    const two = await ys(2);
    expect(two.subToBody / two.size).toBeGreaterThan(2);
    expect(two.ownerToPan / two.size).toBeGreaterThan(3);
    const four = await ys(4);
    expect(four.ownerToPan / four.size).toBeLessThan(two.ownerToPan / two.size);
  });
});
