import { describe, expect, it } from 'vitest';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { defaultConfig } from '../src/lib/defaults';
import { generatePdf } from '../src/lib/pdf';
import { buildReceipts } from '../src/lib/schedule';
import type { Config } from '../src/lib/types';

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
  baseRent: 33333,
  baseRentFrom: '2026-04-01',
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
