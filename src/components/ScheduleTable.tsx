import { useEffect, useState } from 'react';
import { isValidISO, monthLabel } from '../lib/dates';
import type { Config, MonthRow } from '../lib/types';
import { inr } from '../lib/words';

interface Props {
  cfg: Config;
  months: MonthRow[];
  onOverride: (key: string, value: number | null) => void;
  onPaymentDate: (key: string, iso: string | null) => void;
}

/**
 * Keeps what the user is typing in local state and commits only valid values,
 * so clearing a field or a date segment mid-edit does not snap it back.
 */
function useDraft(value: string) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  return [draft, setDraft] as const;
}

function AmountCell({ label, value, onCommit, onClear }: { label: string; value: number; onCommit: (n: number) => void; onClear: () => void }) {
  const [draft, setDraft] = useDraft(String(value));
  return (
    <input
      aria-label={label}
      type="number"
      min={0}
      step="any"
      value={draft}
      onChange={(e) => {
        setDraft(e.target.value);
        const v = Number(e.target.value);
        if (e.target.value !== '' && Number.isFinite(v) && v >= 0) onCommit(v);
      }}
      onBlur={() => {
        if (draft === '') onClear();
        setDraft(String(value));
      }}
    />
  );
}

function DateCell({ label, value, edited, disabled, onCommit }: { label: string; value: string; edited: boolean; disabled: boolean; onCommit: (iso: string) => void }) {
  const [draft, setDraft] = useDraft(value);
  return (
    <input
      aria-label={label}
      type="date"
      className={edited ? 'date-edited' : ''}
      value={draft}
      disabled={disabled}
      title={disabled ? 'Grouped receipts show the first month’s payment date. Switch to monthly receipts to set dates per month.' : undefined}
      onChange={(e) => {
        setDraft(e.target.value);
        if (isValidISO(e.target.value)) onCommit(e.target.value);
      }}
      onBlur={() => setDraft(value)}
    />
  );
}

export function ScheduleTable({ cfg, months, onOverride, onPaymentDate }: Props) {
  if (!months.length) return <p className="muted">Pick a valid rent period to see the month-wise schedule.</p>;
  const total = months.reduce((s, m) => s + m.amount, 0);
  const grouped = cfg.grouping !== 'monthly';
  return (
    <div className="table-wrap">
      <table className="schedule" data-testid="schedule">
        <thead>
          <tr>
            <th>Month</th>
            <th>Covers</th>
            <th className="num">Rent (INR)</th>
            <th>Paid on</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {months.map((m) => (
            <tr key={m.key} className={m.overridden || m.paymentDateOverridden ? 'edited' : ''}>
              <td>{monthLabel(m.key)}</td>
              <td className="muted">{m.days < m.monthDays ? `${m.days} of ${m.monthDays} days` : 'Full month'}</td>
              <td className="num">
                <AmountCell
                  label={`Rent for ${monthLabel(m.key)}`}
                  value={m.amount}
                  onCommit={(n) => onOverride(m.key, n)}
                  onClear={() => onOverride(m.key, null)}
                />
              </td>
              <td>
                <DateCell
                  label={`Payment date for ${monthLabel(m.key)}`}
                  value={m.paymentDate}
                  edited={m.paymentDateOverridden}
                  disabled={grouped}
                  onCommit={(iso) => onPaymentDate(m.key, iso)}
                />
              </td>
              <td>
                {(m.overridden || m.paymentDateOverridden) && (
                  <button
                    type="button"
                    className="link"
                    onClick={() => {
                      if (m.overridden) onOverride(m.key, null);
                      if (m.paymentDateOverridden) onPaymentDate(m.key, null);
                    }}
                    title="Back to computed amount and date"
                  >
                    reset
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={2}>Total, {months.length} month{months.length > 1 ? 's' : ''}</td>
            <td className="num" data-testid="total">{inr(total)}</td>
            <td colSpan={2} />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
