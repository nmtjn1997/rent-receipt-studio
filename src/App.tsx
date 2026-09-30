import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Field, Section } from './components/fields';
import { ScheduleTable } from './components/ScheduleTable';
import { defaultConfig, normalizeConfig } from './lib/defaults';
import { uid } from './lib/uid';
import { fyBounds, fyLabel, fyOf, isValidISO, todayISO } from './lib/dates';
import { buildMonths, buildReceipts } from './lib/schedule';
import { loadStore, saveStore, type Store } from './lib/storage';
import { PAYMENT_MODES, type Config } from './lib/types';
import { validate } from './lib/validate';

const download = (blob: Blob, name: string) => {
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
};

const loadPdf = () => import('./lib/pdf');

const SAMPLE: Partial<Config> = {
  tenantName: 'Alex Sharma',
  landlordName: 'Priya Verma',
  landlordPan: 'ABCDE1234F',
  landlordAddress: '14 Lake View Apartments, MG Road, Bengaluru 560001',
  propertyAddress: 'Flat 4B, Lake View Apartments, MG Road, Bengaluru 560001',
  baseRent: 25000,
  escalationPct: 5,
};

const slug = (s: string) => s.trim().replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() || 'rent';

export function App() {
  const [store, setStore] = useState<Store>(loadStore);
  const cfg = store.configs.find((c) => c.id === store.activeId) ?? store.configs[0];
  const [pdfUrl, setPdfUrl] = useState('');
  const [busy, setBusy] = useState<string>('');
  const [error, setError] = useState('');
  const frame = useRef<HTMLIFrameElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const [storageFailed, setStorageFailed] = useState(false);
  useEffect(() => setStorageFailed(!saveStore(store)), [store]);

  const update = useCallback(
    (patch: Partial<Config>) => {
      setError('');
      setStore((s) => ({ ...s, configs: s.configs.map((c) => (c.id === s.activeId ? { ...c, ...patch } : c)) }));
    },
    [],
  );

  const months = useMemo(() => buildMonths(cfg), [cfg]);
  const receipts = useMemo(() => buildReceipts(cfg, months), [cfg, months]);
  const issues = useMemo(() => validate(cfg, months, receipts, todayISO()), [cfg, months, receipts]);
  const blocked = issues.some((i) => i.level === 'error') || receipts.length === 0;
  const errorFor = (field: string) => issues.find((i) => i.level !== 'info' && i.field === field)?.message;

  useEffect(() => {
    if (blocked) {
      setPdfUrl('');
      return;
    }
    let cancelled = false;
    let url = '';
    const t = setTimeout(async () => {
      try {
        const { generatePdf } = await loadPdf();
        const bytes = await generatePdf(cfg, receipts);
        if (cancelled) return;
        url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: 'application/pdf' }));
        setPdfUrl(url);
        setError('');
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
      if (url) setTimeout(() => URL.revokeObjectURL(url), 60_000);
    };
  }, [cfg, receipts, blocked]);

  const activeFy = isValidISO(cfg.rentFrom) ? fyOf(cfg.rentFrom) : cfg.fyStart;
  const fy = fyLabel(activeFy);
  const baseName = `rent-receipts-${slug(cfg.tenantName)}-fy${fy}`;

  const pickFY = (start: number) => {
    const { from, to } = fyBounds(start);
    update({ fyStart: start, rentFrom: from, rentTo: to });
  };

  const downloadPdf = async () => {
    setBusy('pdf');
    try {
      const { generatePdf } = await loadPdf();
      download(new Blob([(await generatePdf(cfg, receipts)) as BlobPart], { type: 'application/pdf' }), `${baseName}.pdf`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy('');
    }
  };

  const downloadZip = async () => {
    setBusy('zip');
    try {
      const [{ generatePdf }, { default: JSZip }] = await Promise.all([loadPdf(), import('jszip')]);
      const zip = new JSZip();
      for (const [i, r] of receipts.entries()) {
        const bytes = await generatePdf({ ...cfg, perPage: 1 }, [r]);
        zip.file(`${String(i + 1).padStart(2, '0')}-${r.periodStart.slice(0, 7)}.pdf`, bytes);
      }
      download(await zip.generateAsync({ type: 'blob' }), `${baseName}.zip`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy('');
    }
  };

  const printPdf = () => frame.current?.contentWindow?.print();

  const addProfile = (from?: Config) => {
    const next = from ? { ...from, id: uid(), label: `${from.label} copy` } : defaultConfig();
    setStore((s) => ({ activeId: next.id, configs: [...s.configs, next] }));
  };
  const deleteProfile = () => {
    if (store.configs.length < 2 || !confirm(`Delete profile "${cfg.label}"?`)) return;
    setStore((s) => {
      const configs = s.configs.filter((c) => c.id !== s.activeId);
      return { activeId: configs[0].id, configs };
    });
  };

  const exportJson = () =>
    download(new Blob([JSON.stringify({ ...cfg, signature: '' }, null, 2)], { type: 'application/json' }), `${slug(cfg.label)}.json`);

  const importJson = async (file: File) => {
    try {
      const raw = JSON.parse(await file.text()) as Partial<Config>;
      const next = normalizeConfig({ ...raw, id: uid() });
      setStore((s) => ({ activeId: next.id, configs: [...s.configs, next] }));
    } catch {
      setError('That file is not a valid profile JSON.');
    }
  };

  const onSignature = (file?: File) => {
    if (!file) return;
    if (!/^image\/(png|jpeg)$/.test(file.type)) return setError('Signature must be a PNG or JPEG image.');
    if (file.size > 500_000) return setError('Signature image is over 500 KB. Use a smaller image.');
    setError('');
    const reader = new FileReader();
    reader.onload = () => update({ signature: String(reader.result) });
    reader.readAsDataURL(file);
  };

  const text = (key: keyof Config, extra: Record<string, unknown> = {}) => ({
    value: String(cfg[key] ?? ''),
    onChange: (e: { target: { value: string } }) => update({ [key]: e.target.value } as Partial<Config>),
    ...extra,
  });
  const LIMITS: Partial<Record<keyof Config, [number, number]>> = {
    baseRent: [0, 100_000_000], escalationPct: [0, 100], escalationMonths: [1, 120],
  };
  const num = (key: keyof Config) => ({
    type: 'number',
    min: 0,
    value: Number(cfg[key]) || '',
    onChange: (e: { target: { value: string } }) => {
      const [lo, hi] = LIMITS[key] ?? [0, Number.MAX_SAFE_INTEGER];
      update({ [key]: Math.min(hi, Math.max(lo, Number(e.target.value) || 0)) } as Partial<Config>);
    },
  });

  const thisFy = fyOf(todayISO());
  const fyOptions = Array.from(new Set([activeFy, ...Array.from({ length: 8 }, (_, i) => thisFy - 5 + i)])).sort();

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="logo" aria-hidden="true" />
          <div>
            <h1>Rent Receipt Studio</h1>
            <p className="muted">Section 10(13A) rent receipts for a full year. Runs in your browser, nothing is uploaded.</p>
          </div>
        </div>
        <div className="profile-bar">
          <select aria-label="Profile" value={store.activeId} onChange={(e) => setStore((s) => ({ ...s, activeId: e.target.value }))}>
            {store.configs.map((c) => (
              <option key={c.id} value={c.id}>{c.label}</option>
            ))}
          </select>
          <button type="button" onClick={() => addProfile()}>New</button>
          <button type="button" onClick={() => addProfile(cfg)}>Duplicate</button>
          <button type="button" onClick={deleteProfile} disabled={store.configs.length < 2}>Delete</button>
          <button type="button" onClick={exportJson}>Export</button>
          <button type="button" onClick={() => fileInput.current?.click()}>Import</button>
          <input
            ref={fileInput}
            type="file"
            accept="application/json"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void importJson(f);
              e.target.value = '';
            }}
          />
        </div>
      </header>

      <main className="layout">
        <div className="form">
          <Section
            title="Parties"
            aside={
              <button type="button" className="link" onClick={() => update(SAMPLE)}>
                Fill sample data
              </button>
            }
          >
            <Field label="Profile name" hint="Only for you, never printed."><input {...text('label')} /></Field>
            <Field label="Your name (tenant)" required error={errorFor('tenantName')}><input {...text('tenantName', { placeholder: 'As on your rent agreement' })} autoComplete="off" /></Field>
            <Field label="Landlord's name" required error={errorFor('landlordName')}><input {...text('landlordName', { placeholder: 'Owner of the house' })} autoComplete="off" /></Field>
            <Field
              label="Landlord's PAN"
              error={errorFor('landlordPan')}
              hint="Needed when yearly rent is above INR 1 lakh."
            >
              <input
                {...text('landlordPan', { maxLength: 10, autoCapitalize: 'characters', spellCheck: false })}
                onChange={(e) => update({ landlordPan: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '') })}
              />
            </Field>
            <Field label="Landlord's address" wide hint="Leave empty to omit the line.">
              <textarea rows={2} {...text('landlordAddress')} />
            </Field>
            <Field label="Rented property address" wide required error={errorFor('propertyAddress')}>
              <textarea rows={2} {...text('propertyAddress')} />
            </Field>
          </Section>

          <Section title="Rent and period">
            <Field label="Financial year">
              <select value={activeFy} onChange={(e) => pickFY(Number(e.target.value))}>
                {fyOptions.map((y) => (
                  <option key={y} value={y}>FY {fyLabel(y)}</option>
                ))}
              </select>
            </Field>
            <Field label="Payment mode">
              <select {...text('paymentMode')}>
                {[...PAYMENT_MODES, ...((PAYMENT_MODES as readonly string[]).includes(cfg.paymentMode) ? [] : [cfg.paymentMode])].map((m) => (
                  <option key={m}>{m}</option>
                ))}
              </select>
            </Field>
            <Field label="Rent from" required error={errorFor('rentFrom')}><input type="date" {...text('rentFrom')} /></Field>
            <Field label="Rent upto" required><input type="date" {...text('rentTo')} /></Field>
            <Field label="Monthly rent (INR)" required error={errorFor('baseRent')} hint="Rent from the agreement start date below.">
              <input {...num('baseRent')} inputMode="numeric" />
            </Field>
            <Field label="Rent in force since" hint="Agreement or last revision date.">
              <input type="date" {...text('baseRentFrom')} />
            </Field>
            <Field label="Yearly increase (%)" hint="0 for a flat rent.">
              <input {...num('escalationPct')} step="0.5" />
            </Field>
            <Field label="Increase every (months)">
              <input {...num('escalationMonths')} />
            </Field>
            <Field label="Paid on day of month" hint="1 to 28 (later days clamp to month end).">
              <input type="number" min={1} max={31} value={cfg.paymentDay} onChange={(e) => update({ paymentDay: Math.min(31, Math.max(1, Number(e.target.value) || 1)) })} />
            </Field>
            <Field label="Partial months">
              <select value={cfg.prorate ? 'pro' : 'full'} onChange={(e) => update({ prorate: e.target.value === 'pro' })}>
                <option value="pro">Prorate by days</option>
                <option value="full">Charge full month</option>
              </select>
            </Field>
          </Section>

          <Section
            title="Month-wise schedule"
            aside={<span className="pill">{months.length} months, {receipts.length} receipt{receipts.length === 1 ? '' : 's'}</span>}
          >
            <div className="wide">
              <ScheduleTable
                cfg={cfg}
                months={months}
                onOverride={(key, value) => {
                  const overrides = { ...cfg.overrides };
                  if (value === null) delete overrides[key];
                  else overrides[key] = value;
                  update({ overrides });
                }}
              />
            </div>
          </Section>

          <Section title="Look and layout">
            <Field label="Receipts as">
              <select {...text('grouping')}>
                <option value="monthly">Monthly (one per month)</option>
                <option value="quarterly">Quarterly</option>
                <option value="half-yearly">Half-yearly</option>
                <option value="consolidated">Consolidated (one for all)</option>
              </select>
            </Field>
            <Field label="Receipts per page">
              <select value={cfg.perPage} onChange={(e) => update({ perPage: Number(e.target.value) as Config['perPage'] })}>
                {[1, 2, 3, 4].map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </Field>
            <Field label="Template">
              <select {...text('template')}>
                <option value="classic">Classic</option>
                <option value="modern">Modern (colour band)</option>
                <option value="minimal">Boxed</option>
              </select>
            </Field>
            <Field label="Font">
              <select {...text('font')}>
                <option>Helvetica</option>
                <option>Times</option>
                <option>Courier</option>
              </select>
            </Field>
            <Field label="Accent colour"><input type="color" {...text('accent')} /></Field>
            <Field label="Date style">
              <select {...text('dateFormat')}>
                <option value="mdy">Apr 1, 2026</option>
                <option value="dmy">01/04/2026</option>
                <option value="long">1 April 2026</option>
              </select>
            </Field>
            <Field label="Title" wide><input {...text('title')} /></Field>
            <Field label="Sub-title" wide><input {...text('subtitle')} /></Field>
            <Field label="Footer line" wide hint="Optional, printed small under each receipt."><input {...text('footer')} /></Field>
            <Field label="Receipt numbers">
              <select value={cfg.numbering ? 'on' : 'off'} onChange={(e) => update({ numbering: e.target.value === 'on' })}>
                <option value="off">Off</option>
                <option value="on">On</option>
              </select>
            </Field>
            <Field label="Number prefix"><input {...text('numberPrefix')} disabled={!cfg.numbering} /></Field>
            <div className="wide checks">
              <label><input type="checkbox" checked={cfg.showStamp} onChange={(e) => update({ showStamp: e.target.checked })} /> Revenue stamp line</label>
              <label><input type="checkbox" checked={cfg.showPan} onChange={(e) => update({ showPan: e.target.checked })} /> Show landlord PAN</label>
              <label><input type="checkbox" checked={cfg.grayPage} onChange={(e) => update({ grayPage: e.target.checked })} /> Grey page tint</label>
            </div>
            <Field label="Owner's signature image" wide hint="PNG or JPEG. Stays in this browser; leave empty to sign by hand after printing.">
              <div className="sig-row">
                <input type="file" accept="image/png,image/jpeg" onChange={(e) => onSignature(e.target.files?.[0])} />
                {cfg.signature && (
                  <>
                    <img className="sig-thumb" src={cfg.signature} alt="Signature preview" />
                    <button type="button" className="link" onClick={() => update({ signature: '' })}>remove</button>
                  </>
                )}
              </div>
            </Field>
          </Section>
        </div>

        <aside className="preview">
          <div className="preview-actions">
            <button type="button" className="primary" onClick={downloadPdf} disabled={blocked || busy !== ''} data-testid="download-pdf">
              {busy === 'pdf' ? 'Preparing…' : `Download PDF (${receipts.length})`}
            </button>
            <button type="button" onClick={downloadZip} disabled={blocked || busy !== ''} data-testid="download-zip">
              {busy === 'zip' ? 'Zipping…' : 'ZIP of single PDFs'}
            </button>
            <button type="button" onClick={printPdf} disabled={!pdfUrl}>Print</button>
            {pdfUrl && (
              <a className="btn-link" href={pdfUrl} target="_blank" rel="noopener">
                Open in new tab
              </a>
            )}
          </div>
          {issues.length > 0 && (
            <ul className="issues" data-testid="issues" role="status" aria-live="polite">
              {issues.map((i, n) => (
                <li key={n} className={i.level}>{i.message}</li>
              ))}
            </ul>
          )}
          {error && <p className="banner err" role="alert">{error}</p>}
          {storageFailed && (
            <p className="banner err" role="alert">
              This browser is not saving your profiles (storage is full or blocked). Use Export to keep a copy.
            </p>
          )}
          <div className="frame">
            {pdfUrl ? (
              <iframe ref={frame} title="Receipt preview" src={pdfUrl} data-testid="preview" />
            ) : (
              <div className="empty">Fill the required fields to see the live preview.</div>
            )}
          </div>
        </aside>
      </main>
    </div>
  );
}
