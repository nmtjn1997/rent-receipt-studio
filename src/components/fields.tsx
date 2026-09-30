import type { ReactNode } from 'react';

interface FieldProps {
  label: string;
  children: ReactNode;
  hint?: string;
  error?: string;
  wide?: boolean;
  required?: boolean;
}

export function Field({ label, children, hint, error, wide, required }: FieldProps) {
  return (
    <label className={'field' + (wide ? ' wide' : '') + (error ? ' has-error' : '')}>
      <span className="field-label">
        {label}
        {required && <b aria-hidden="true"> *</b>}
      </span>
      {children}
      {error ? <span className="field-msg err">{error}</span> : hint ? <span className="field-msg">{hint}</span> : null}
    </label>
  );
}

export function Section({ title, children, aside }: { title: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <section className="card">
      <header className="card-head">
        <h2>{title}</h2>
        {aside}
      </header>
      <div className="grid">{children}</div>
    </section>
  );
}
