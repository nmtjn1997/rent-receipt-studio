import { cloneElement, isValidElement, useId, type ReactElement, type ReactNode } from 'react';

interface FieldProps {
  label: string;
  children: ReactNode;
  hint?: string;
  error?: string;
  wide?: boolean;
  required?: boolean;
}

/** Label sits outside the control, hint and error are linked with aria-describedby. */
export function Field({ label, children, hint, error, wide, required }: FieldProps) {
  const id = useId();
  const msgId = `${id}-msg`;
  const control =
    isValidElement(children) && typeof children.type !== 'string'
      ? children
      : isValidElement(children) && children.type !== 'div'
        ? cloneElement(children as ReactElement<Record<string, unknown>>, {
            id,
            'aria-describedby': error || hint ? msgId : undefined,
            'aria-invalid': error ? true : undefined,
            'aria-required': required ? true : undefined,
          })
        : children;
  return (
    <div className={'field' + (wide ? ' wide' : '') + (error ? ' has-error' : '')}>
      <label className="field-label" htmlFor={id}>
        {label}
        {required && <b aria-hidden="true"> *</b>}
      </label>
      {control}
      {error ? (
        <span id={msgId} className="field-msg err" role="alert">{error}</span>
      ) : hint ? (
        <span id={msgId} className="field-msg">{hint}</span>
      ) : null}
    </div>
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
