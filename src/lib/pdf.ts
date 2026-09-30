import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb } from 'pdf-lib';
import { formatDate, monthLabel } from './dates';
import type { Config, FontFamily, Receipt } from './types';
import { amountToWords, inr } from './words';

interface Seg {
  t: string;
  b?: boolean;
}
interface Word {
  t: string;
  b: boolean;
  w: number;
}
type Line = Word[];

interface Fonts {
  regular: PDFFont;
  bold: PDFFont;
}

const A4 = { w: 595.28, h: 841.89 };
const MARGIN = 46;

const FAMILY: Record<FontFamily, [StandardFonts, StandardFonts]> = {
  Helvetica: [StandardFonts.Helvetica, StandardFonts.HelveticaBold],
  Times: [StandardFonts.TimesRoman, StandardFonts.TimesRomanBold],
  Courier: [StandardFonts.Courier, StandardFonts.CourierBold],
};

const BASE_SIZE = { 1: 14, 2: 12.5, 3: 10.5, 4: 9 } as const;

export function hexToRgb(hex: string) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  const n = m ? parseInt(m[1], 16) : 0x0f766e;
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}

/** Standard PDF fonts cover Latin-1 only; anything else would make pdf-lib throw. */
function clean(text: string, font: PDFFont): string {
  const supported = new Set(font.getCharacterSet());
  return Array.from(text.replace(/₹/g, 'INR '))
    .map((ch) => (ch === '\n' || supported.has(ch.codePointAt(0)!) ? ch : '?'))
    .join('');
}

/** Splits a token that is wider than the line into pieces that each fit. */
function chunkToFit(part: string, font: PDFFont, size: number, maxW: number): string[] {
  if (font.widthOfTextAtSize(part, size) <= maxW) return [part];
  const chunks: string[] = [];
  let cur = '';
  for (const ch of Array.from(part)) {
    if (cur && font.widthOfTextAtSize(cur + ch, size) > maxW) {
      chunks.push(cur);
      cur = '';
    }
    cur += ch;
  }
  if (cur) chunks.push(cur);
  return chunks;
}

function tokenize(segs: Seg[], fonts: Fonts, size: number, maxW: number): Word[] {
  const words: Word[] = [];
  for (const seg of segs) {
    const font = seg.b ? fonts.bold : fonts.regular;
    for (const part of clean(seg.t, font).split(/(\n|[ \t]+)/)) {
      if (part === '') continue;
      if (part === '\n') words.push({ t: part, b: !!seg.b, w: 0 });
      else for (const piece of chunkToFit(part, font, size, maxW)) words.push({ t: piece, b: !!seg.b, w: font.widthOfTextAtSize(piece, size) });
    }
  }
  return words;
}

function wrap(segs: Seg[], fonts: Fonts, size: number, maxW: number): Line[] {
  const lines: Line[] = [[]];
  let x = 0;
  for (const word of tokenize(segs, fonts, size, maxW)) {
    if (word.t === '\n') {
      lines.push([]);
      x = 0;
      continue;
    }
    const isSpace = /^[ \t]+$/.test(word.t);
    if (isSpace && x === 0) continue;
    if (!isSpace && x + word.w > maxW && x > 0) {
      lines[lines.length - 1] = trimEnd(lines[lines.length - 1]);
      lines.push([]);
      x = 0;
    }
    lines[lines.length - 1].push(word);
    x += word.w;
  }
  lines[lines.length - 1] = trimEnd(lines[lines.length - 1]);
  return lines;
}

function trimEnd(line: Line): Line {
  const out = [...line];
  while (out.length && /^[ \t]+$/.test(out[out.length - 1].t)) out.pop();
  return out;
}

const lineWidth = (line: Line) => line.reduce((s, w) => s + w.w, 0);

interface DrawOpts {
  x: number;
  y: number;
  size: number;
  lineH: number;
  maxW: number;
  align?: 'left' | 'right' | 'center';
  color?: ReturnType<typeof rgb>;
}

/** Draws wrapped rich text with the first baseline at `y`; returns the y below the last line. */
function drawRich(page: PDFPage, fonts: Fonts, segs: Seg[], o: DrawOpts): number {
  const lines = wrap(segs, fonts, o.size, o.maxW);
  let y = o.y;
  for (const line of lines) {
    const w = lineWidth(line);
    let x = o.x;
    if (o.align === 'right') x = o.x + o.maxW - w;
    else if (o.align === 'center') x = o.x + (o.maxW - w) / 2;
    for (const word of line) {
      if (!/^[ \t]+$/.test(word.t)) {
        page.drawText(word.t, {
          x,
          y,
          size: o.size,
          font: word.b ? fonts.bold : fonts.regular,
          color: o.color ?? rgb(0.08, 0.08, 0.08),
        });
      }
      x += word.w;
    }
    y -= o.lineH;
  }
  return y;
}

export function receiptBody(cfg: Config, r: Receipt): Seg[] {
  const d = (iso: string) => formatDate(iso, cfg.dateFormat);
  const rents = new Set(r.months.map((m) => m.rent));
  // "@ INR x per month" is only true when every month is billed at exactly that rent.
  const flatRate = rents.size === 1 && r.months.every((m) => m.amount === m.rent);
  const segs: Seg[] = [
    { t: 'Received a sum of ' },
    { t: `INR ${inr(r.amount)}/-`, b: true },
    { t: ' (in words) ' },
    { t: amountToWords(r.amount), b: true },
    { t: ' from the occupant ' },
    { t: cfg.tenantName, b: true },
    { t: ' via (payment mode) ' },
    { t: cfg.paymentMode, b: true },
    { t: ' on (payment date) ' },
    { t: d(r.paymentDate), b: true },
    { t: ' towards the rent' },
  ];
  if (flatRate) {
    segs.push({ t: ' @ ' }, { t: `INR ${inr(r.months[0].rent)}`, b: true }, { t: ' per month' });
  }
  segs.push(
    { t: ' from ' },
    { t: d(r.periodStart), b: true },
    { t: ' to ' },
    { t: d(r.periodEnd), b: true },
    { t: ' for the house/apartment/accommodation/property situated at ' },
    { t: cfg.propertyAddress.replace(/\s*\n\s*/g, ', ').trim(), b: true },
    { t: '.' },
  );
  if (r.months.length > 1 && !flatRate) {
    segs.push({ t: ' Month-wise: ' + r.months.map((m) => `${monthLabel(m.key)} INR ${inr(m.amount)}`).join('; ') + '.' });
  }
  return segs;
}

async function embedSignature(pdf: PDFDocument, dataUrl: string) {
  if (!dataUrl) return undefined;
  // The declared MIME type comes from a file extension, so trust the bytes instead.
  const bytes = Uint8Array.from(atob(dataUrl.split(',')[1] ?? ''), (c) => c.charCodeAt(0));
  try {
    if (bytes[0] === 0x89 && bytes[1] === 0x50) return await pdf.embedPng(bytes);
    if (bytes[0] === 0xff && bytes[1] === 0xd8) return await pdf.embedJpg(bytes);
  } catch {
    /* falls through to the error below */
  }
  throw new Error('The signature image could not be read. Remove it or upload a standard PNG or JPEG.');
}

function drawDashedRule(page: PDFPage, y: number, x1: number, x2: number) {
  page.drawLine({
    start: { x: x1, y },
    end: { x: x2, y },
    thickness: 0.6,
    color: rgb(0.62, 0.62, 0.62),
    dashArray: [4, 3],
  });
}

const MIN_SIZE = 7;

/**
 * Largest font size (shared by every receipt, so the page looks even) at which
 * each receipt still fits its slot. Measured by drawing on a scratch document.
 */
async function fitSize(cfg: Config, receipts: Receipt[], slotH: number, contentW: number): Promise<number | null> {
  const scratch = await PDFDocument.create();
  const [reg, bold] = FAMILY[cfg.font];
  const fonts: Fonts = { regular: await scratch.embedFont(reg), bold: await scratch.embedFont(bold) };
  const accent = hexToRgb(cfg.accent);
  for (let size: number = BASE_SIZE[cfg.perPage]; size >= MIN_SIZE; size -= 0.5) {
    const top = A4.h - MARGIN;
    const fits = receipts.every((r) => {
      const page = scratch.addPage([A4.w, A4.h]);
      const bottom = drawOne(page, fonts, cfg, r, { top: top - 14, size, lineH: size * 1.55, contentW, sig: undefined, accent });
      return top - bottom <= slotH - 6;
    });
    if (fits) return size;
  }
  return null;
}

export async function generatePdf(cfg: Config, receipts: Receipt[]): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Rent receipts ${cfg.rentFrom} to ${cfg.rentTo}`);
  pdf.setCreator('Rent Receipt Studio');
  pdf.setProducer('Rent Receipt Studio');
  const [reg, bold] = FAMILY[cfg.font];
  const fonts: Fonts = { regular: await pdf.embedFont(reg), bold: await pdf.embedFont(bold) };
  const sig = await embedSignature(pdf, cfg.signature);
  const accent = hexToRgb(cfg.accent);
  const per = cfg.perPage;
  const contentW = A4.w - MARGIN * 2;
  const slotH = (A4.h - MARGIN * 2) / per;
  const size = await fitSize(cfg, receipts, slotH, contentW);
  if (size === null) {
    throw new Error(`The text is too long to fit ${per} receipt${per > 1 ? 's' : ''} per page. Shorten the addresses or use fewer receipts per page.`);
  }
  const lineH = size * 1.55;
  const pageCount = Math.max(1, Math.ceil(receipts.length / per));

  for (let p = 0; p < pageCount; p++) {
    const page = pdf.addPage([A4.w, A4.h]);
    if (cfg.grayPage) page.drawRectangle({ x: 0, y: 0, width: A4.w, height: A4.h, color: rgb(0.94, 0.94, 0.93) });
    for (let s = 0; s < per; s++) {
      const r = receipts[p * per + s];
      if (!r) break;
      const top = A4.h - MARGIN - s * slotH;
      if (s > 0) drawDashedRule(page, top + 6, MARGIN - 10, A4.w - MARGIN + 10);
      drawOne(page, fonts, cfg, r, { top: top - 14, size, lineH, contentW, sig, accent });
    }
  }
  return pdf.save();
}

interface Ctx {
  top: number;
  size: number;
  lineH: number;
  contentW: number;
  sig: Awaited<ReturnType<typeof embedSignature>>;
  accent: ReturnType<typeof rgb>;
}

function drawOne(page: PDFPage, fonts: Fonts, cfg: Config, r: Receipt, c: Ctx): number {
  const x0 = MARGIN;
  const titleSize = c.size + 6;
  const ink = rgb(0.08, 0.08, 0.08);
  let y = c.top;

  if (cfg.template === 'minimal') {
    // The border is drawn after layout, once the block height is known.
    y -= 6;
  }

  if (cfg.template === 'modern') {
    const subSize = c.size - 2.5;
    const bandTop = c.top + 14;
    const bandH = titleSize + subSize + 24;
    page.drawRectangle({ x: x0, y: bandTop - bandH, width: c.contentW, height: bandH, color: c.accent });
    drawRich(page, fonts, [{ t: cfg.title, b: true }], {
      x: x0, y: bandTop - titleSize - 6, size: titleSize, lineH: titleSize, maxW: c.contentW, align: 'center', color: rgb(1, 1, 1),
    });
    drawRich(page, fonts, [{ t: cfg.subtitle }], {
      x: x0, y: bandTop - titleSize - subSize - 12, size: subSize, lineH: subSize, maxW: c.contentW, align: 'center', color: rgb(0.92, 0.97, 0.96),
    });
    if (r.no) {
      drawRich(page, fonts, [{ t: `No. ${r.no}` }], {
        x: x0 + 8, y: bandTop - 12, size: c.size - 3.5, lineH: c.size, maxW: c.contentW - 16, align: 'right', color: rgb(0.92, 0.97, 0.96),
      });
    }
    y = bandTop - bandH - c.lineH;
  } else {
    y = drawRich(page, fonts, [{ t: cfg.title, b: cfg.template === 'minimal' }], {
      x: x0, y, size: titleSize, lineH: titleSize + 4, maxW: c.contentW, align: 'center',
    });
    y = drawRich(page, fonts, [{ t: cfg.subtitle }], {
      x: x0, y: y + 1, size: c.size - 2.5, lineH: c.size, maxW: c.contentW, align: 'center', color: rgb(0.3, 0.3, 0.3),
    });
    y -= 10;
  }

  if (r.no && cfg.template !== 'modern') {
    drawRich(page, fonts, [{ t: `Receipt No. ${r.no}` }], {
      x: x0, y: c.top + 6, size: c.size - 3, lineH: c.size, maxW: c.contentW, align: 'right', color: rgb(0.4, 0.4, 0.4),
    });
  }

  y = drawRich(page, fonts, receiptBody(cfg, r), { x: x0, y, size: c.size, lineH: c.lineH, maxW: c.contentW });
  y -= c.lineH * 0.7;

  const leftW = c.contentW * 0.6;
  const rightW = c.contentW * 0.36;
  const rightX = x0 + c.contentW - rightW;
  const ownerSegs: Seg[][] = [[{ t: 'Name of Owner: ' }, { t: cfg.landlordName, b: true }]];
  if (cfg.landlordAddress.trim()) ownerSegs.push([{ t: 'Address: ' }, { t: cfg.landlordAddress.trim(), b: true }]);
  if (cfg.showPan && cfg.landlordPan.trim()) ownerSegs.push([{ t: 'PAN: ' }, { t: cfg.landlordPan.trim().toUpperCase(), b: true }]);
  let ly = y;
  for (const segs of ownerSegs) {
    ly = drawRich(page, fonts, segs, { x: x0, y: ly, size: c.size, lineH: c.lineH * 0.95, maxW: leftW });
  }

  let ry = y;
  if (cfg.showStamp) {
    ry = drawRich(page, fonts, [{ t: '(Affix Revenue Stamp of Re.1/)' }], {
      x: rightX, y: ry, size: c.size - 1, lineH: c.lineH * 0.9, maxW: rightW, align: 'right',
    });
  }
  const sigH = c.size * 3.2;
  if (c.sig) {
    const scale = Math.min((rightW * 0.7) / c.sig.width, sigH / c.sig.height);
    const w = c.sig.width * scale;
    const h = c.sig.height * scale;
    page.drawImage(c.sig, { x: x0 + c.contentW - w, y: ry - h - 2, width: w, height: h });
  }
  ry -= sigH;
  page.drawLine({
    start: { x: rightX + rightW * 0.1, y: ry + c.lineH * 0.55 },
    end: { x: x0 + c.contentW, y: ry + c.lineH * 0.55 },
    thickness: 0.5,
    color: rgb(0.5, 0.5, 0.5),
  });
  ry = drawRich(page, fonts, [{ t: 'Signature of House Owner' }], {
    x: rightX, y: ry, size: c.size - 0.5, lineH: c.lineH * 0.95, maxW: rightW, align: 'right',
  });
  ry = drawRich(page, fonts, [{ t: 'Date: ' }, { t: formatDate(r.paymentDate, cfg.dateFormat), b: true }], {
    x: rightX, y: ry, size: c.size - 0.5, lineH: c.lineH * 0.95, maxW: rightW, align: 'right',
  });

  let bottom = Math.min(ly, ry);
  if (cfg.footer.trim()) {
    bottom = drawRich(page, fonts, [{ t: cfg.footer.trim() }], {
      x: x0, y: bottom - 4, size: c.size - 3, lineH: c.size, maxW: c.contentW, align: 'center', color: rgb(0.45, 0.45, 0.45),
    });
  }

  if (cfg.template === 'minimal') {
    const boxTop = c.top + 18;
    const boxBottom = bottom + c.lineH * 0.2;
    page.drawRectangle({
      x: x0 - 10, y: boxBottom, width: c.contentW + 20, height: boxTop - boxBottom,
      borderColor: ink, borderWidth: 0.8,
    });
  }
  if (cfg.template === 'modern') {
    page.drawLine({
      start: { x: x0, y: bottom - 6 },
      end: { x: x0 + c.contentW, y: bottom - 6 },
      thickness: 1.2,
      color: c.accent,
    });
  }
  return bottom;
}
