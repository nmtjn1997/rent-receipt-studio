import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { generate } from './generate';
import { inr } from '../lib/words';

const server = new McpServer({ name: 'rent-receipt', version: '0.2.0' });

server.registerTool(
  'generate_rent_receipts',
  {
    title: 'Generate rent receipts',
    description:
      'Create HRA rent receipts (Section 10(13A)) as a PDF file on this machine and return its path. ' +
      'Needs tenant, landlord, property address and monthly rent. Defaults to the current financial year, one receipt per month. ' +
      'Use `through` to stop at the last month actually paid, so no receipt is dated in the future.',
    inputSchema: {
      tenant: z.string().min(1).describe('Tenant (payer) name as on the agreement'),
      landlord: z.string().min(1).describe('Landlord (owner) name'),
      property: z.string().min(1).describe('Address of the rented house'),
      rent: z.number().positive().describe('Monthly rent in INR'),
      fy: z.number().int().optional().describe('Financial year start, 2026 means FY 2026-27. Default: current FY'),
      through: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/).optional().describe('Last month to include, YYYY-MM'),
      grouping: z.enum(['monthly', 'quarterly', 'half-yearly', 'consolidated']).optional().describe('Default monthly'),
      pan: z.string().optional().describe('Landlord PAN, needed when yearly rent exceeds INR 1 lakh'),
      landlord_address: z.string().optional().describe('Defaults to the property address'),
      mode: z.string().optional().describe('Payment mode, default Online Transfer'),
      pay_day: z.number().int().min(1).max(31).optional().describe('Day of month rent is paid, default 1'),
      per_page: z.number().int().min(1).max(4).optional().describe('Receipts per A4 page, default 2'),
      template: z.enum(['classic', 'modern', 'minimal']).optional(),
      out: z.string().optional().describe('Output PDF path. Default: current directory'),
      profile: z.string().optional().describe('Path to a profile JSON exported from the web app, supplies any field not given'),
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  async (a) => {
    try {
      const r = await generate({
        tenant: a.tenant, landlord: a.landlord, property: a.property, rent: a.rent, fy: a.fy, through: a.through,
        grouping: a.grouping, pan: a.pan, landlordAddress: a.landlord_address, mode: a.mode, payDay: a.pay_day,
        perPage: a.per_page as 1 | 2 | 3 | 4 | undefined, template: a.template, out: a.out, profile: a.profile,
      });
      const lines = [
        `Wrote ${r.receipts} receipt(s) for ${r.months} month(s), INR ${inr(r.total)} in total (${r.period.from} to ${r.period.to}).`,
        `File: ${r.path}`,
        ...r.warnings.map((w) => `Note: ${w}`),
      ];
      return { content: [{ type: 'text' as const, text: lines.join('\n') }], structuredContent: { ...r } };
    } catch (e) {
      return { isError: true, content: [{ type: 'text' as const, text: e instanceof Error ? e.message : String(e) }] };
    }
  },
);

await server.connect(new StdioServerTransport());
