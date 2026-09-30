import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { defaultConfig } from '../src/lib/defaults';
import { generatePdf } from '../src/lib/pdf';
import { buildReceipts } from '../src/lib/schedule';

// `SAMPLES_DIR=out npm run samples` writes one PDF per template so a human or an agent can look at the layout.
const dir = process.env.SAMPLES_DIR;

describe.skipIf(!dir)('sample PDFs', () => {
  it('writes each template', async () => {
    mkdirSync(dir!, { recursive: true });
    for (const template of ['classic', 'modern', 'minimal'] as const) {
      const cfg = {
        ...defaultConfig(new Date('2026-09-30')),
        template,
        tenantName: 'Test Tenant',
        landlordName: 'Test Landlord',
        landlordPan: 'ABCDE1234F',
        landlordAddress: '12 Sample Road, Sample Nagar, Sample City 000000',
        propertyAddress: '12 Sample Road, Sample Nagar, Sample City 000000',
        baseRent: 66000,
        baseRentFrom: '2025-04-01',
        escalationPct: 10,
        fyStart: 2026,
        rentFrom: '2026-04-01',
        rentTo: '2027-03-31',
        numbering: true,
        numberPrefix: 'RR-2627-',
        footer: 'Computer generated receipt',
      };
      const bytes = await generatePdf(cfg, buildReceipts(cfg));
      writeFileSync(join(dir!, `sample-${template}.pdf`), bytes);
      expect(bytes.byteLength).toBeGreaterThan(2000);
    }
  });
});
