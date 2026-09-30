import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { describe, expect, it } from 'vitest';
import { generate } from '../src/cli/generate';

const dir = mkdtempSync(join(tmpdir(), 'rr-cli-'));
const REQUIRED = { tenant: 'Test Tenant', landlord: 'Test Landlord', property: '12 Sample Road, Testville', rent: 25000 };

async function text(path: string) {
  const doc = await getDocument({ data: new Uint8Array(readFileSync(path)), useSystemFonts: true }).promise;
  const pages: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    pages.push((await (await doc.getPage(i)).getTextContent()).items.map((it) => ('str' in it ? it.str : '')).join(' ').replace(/\s+/g, ' '));
  }
  return { numPages: doc.numPages, text: pages.join(' ') };
}

const cli = (args: string[]) => spawnSync(process.execPath, ['bin/rent-receipt.mjs', ...args], { encoding: 'utf8' });

describe('generate()', () => {
  it('needs only tenant, landlord, property and rent, and defaults to a monthly full FY', async () => {
    const out = join(dir, 'a.pdf');
    const r = await generate({ ...REQUIRED, fy: 2026, out }, new Date('2026-09-30'));
    expect(r).toMatchObject({ receipts: 12, months: 12, total: 300000, path: out, period: { from: '2026-04-01', to: '2027-03-31' } });
    const { numPages, text: t } = await text(out);
    expect(numPages).toBe(6);
    expect(t).toContain('Rupees Twenty Five Thousand Only');
    expect(t).toContain('Address: 12 Sample Road, Testville');
  });
  it('through stops at the last paid month so nothing is future dated', async () => {
    const r = await generate({ ...REQUIRED, fy: 2026, through: '2026-09', out: join(dir, 'b.pdf') }, new Date('2026-09-30'));
    expect(r).toMatchObject({ receipts: 6, total: 150000, period: { to: '2026-09-30' } });
    expect(r.warnings.some((w) => w.includes('future'))).toBe(false);
  });
  it('warns, but still writes, when receipts are future dated', async () => {
    const r = await generate({ ...REQUIRED, fy: 2026, out: join(dir, 'c.pdf') }, new Date('2026-09-30'));
    expect(r.warnings.some((w) => w.includes('future'))).toBe(true);
  });
  it('supports quarterly and consolidated grouping', async () => {
    expect((await generate({ ...REQUIRED, fy: 2026, grouping: 'quarterly', out: join(dir, 'q.pdf') })).receipts).toBe(4);
    const one = await generate({ ...REQUIRED, fy: 2026, grouping: 'consolidated', out: join(dir, 'k.pdf') });
    expect(one.receipts).toBe(1);
    expect((await text(one.path)).text).toContain('INR 3,00,000/-');
  });
  it('reads a profile and lets flags override it', async () => {
    const profile = join(dir, 'p.json');
    writeFileSync(profile, JSON.stringify([{ tenantName: 'P Tenant', landlordName: 'P Landlord', propertyAddress: 'P Street', monthlyRent: 10000 }]));
    const r = await generate({ profile, rent: 12000, fy: 2026, through: '2026-04', out: join(dir, 'pf.pdf') });
    expect(r.total).toBe(12000);
    expect((await text(r.path)).text).toContain('P Tenant');
  });
  it('rejects missing or invalid input with a readable message', async () => {
    await expect(generate({ tenant: 'x' })).rejects.toThrow(/required/i);
    await expect(generate({ ...REQUIRED, pan: 'nope', out: join(dir, 'x.pdf') })).rejects.toThrow(/PAN/);
    await expect(generate({ ...REQUIRED, through: '2026-13' })).rejects.toThrow(/YYYY-MM/);
    await expect(generate({ ...REQUIRED, from: '2027-01-01', to: '2026-01-01' })).rejects.toThrow();
  });
});

describe('rent-receipt CLI', () => {
  it('prints help', () => {
    const r = cli(['--help']);
    expect(r.status).toBe(0);
    expect(r.stdout).toContain('--tenant');
    expect(r.stdout).toContain('--through');
  }, 30_000);
  it('writes a PDF and prints its path', () => {
    const out = join(dir, 'cli.pdf');
    const r = cli(['--tenant', 'Test Tenant', '--landlord', 'Test Landlord', '--property', '12 Sample Road', '--rent', '25000', '--fy', '2025', '--out', out]);
    expect(r.status).toBe(0);
    expect(r.stdout).toContain('12 receipts for 12 months');
    expect(r.stdout.trim().endsWith(out)).toBe(true);
    expect(existsSync(out)).toBe(true);
  }, 30_000);
  it('emits JSON with --json', () => {
    const r = cli(['--tenant', 'T', '--landlord', 'L', '--property', 'P', '--rent', '1000', '--fy', '2025', '--json', '--out', join(dir, 'j.pdf')]);
    expect(JSON.parse(r.stdout)).toMatchObject({ receipts: 12, total: 12000 });
  }, 30_000);
  it('fails with exit 1 and a message for bad input', () => {
    const r = cli(['--tenant', 'T', '--rent', 'abc']);
    expect(r.status).toBe(1);
    expect(r.stderr).toContain('--rent must be a number');
    expect(cli(['--bogus']).status).toBe(1);
    expect(cli(['--tenant', 'T', '--landlord', 'L', '--property', 'P', '--rent', '5', '--grouping', 'weekly']).stderr).toContain('--grouping must be one of');
  }, 30_000);
});

describe('rent-receipt MCP server', () => {
  it('lists the tool and generates a PDF over stdio', async () => {
    const client = new Client({ name: 'test', version: '0' });
    await client.connect(new StdioClientTransport({ command: process.execPath, args: ['bin/rent-receipt-mcp.mjs'] }));
    try {
      const tools = await client.listTools();
      expect(tools.tools.map((t) => t.name)).toEqual(['generate_rent_receipts']);
      const out = join(dir, 'mcp.pdf');
      const res = await client.callTool({
        name: 'generate_rent_receipts',
        arguments: { tenant: 'Test Tenant', landlord: 'Test Landlord', property: '12 Sample Road', rent: 20000, fy: 2025, through: '2025-06', out },
      });
      const first = (res.content as Array<{ text: string }>)[0].text;
      expect(res.isError).toBeFalsy();
      expect(first).toContain('Wrote 3 receipt(s)');
      expect(first).toContain(out);
      expect((await text(out)).text).toContain('Rupees Twenty Thousand Only');
      const bad = await client.callTool({ name: 'generate_rent_receipts', arguments: { tenant: 'T', landlord: 'L', property: 'P', rent: 100, pan: 'nope' } });
      expect(bad.isError).toBe(true);
    } finally {
      await client.close();
    }
  }, 60_000);
});
