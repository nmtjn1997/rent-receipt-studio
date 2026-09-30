import { isValidISO, monthLabel } from '../lib/dates';
import type { Config, MonthRow } from '../lib/types';
import { inr } from '../lib/words';

interface Props {
  cfg: Config;
  months: MonthRow[];
  onOverride: (key: string, value: number | null) => void;
  onPaymentDate: (key: string, iso: string | null) => void;
}

export function ScheduleTable({ months, onOverride, onPaymentDate }: Props) {
  if (!months.length) return <p className="muted">Pick a valid rent period to see the month-wise schedule.</p>;
  const total = months.reduce((s, m) => s + m.amount, 0);
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
              <td className="muted">
                {m.days < m.monthDays ? `${m.days} of ${m.monthDays} days` : 'Full month'}
              </td>
              <td className="num">
                <input
                  aria-label={`Rent for ${monthLabel(m.key)}`}
                  type="number"
                  min={0}
                  value={m.amount}
                  onChange={(e) => {
                    if (e.target.value === '') return onOverride(m.key, null);
                    const v = Number(e.target.value);
                    if (Number.isFinite(v) && v >= 0) onOverride(m.key, v);
                  }}
                />
              </td>
              <td>
                <input
                  aria-label={`Payment date for ${monthLabel(m.key)}`}
                  type="date"
                  className={m.paymentDateOverridden ? 'date-edited' : ''}
                  value={m.paymentDate}
                  onChange={(e) => onPaymentDate(m.key, isValidISO(e.target.value) ? e.target.value : null)}
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
