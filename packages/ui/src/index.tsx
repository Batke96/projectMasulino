import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from "react";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "danger";
};

const buttonStyles = {
  primary: "bg-accent text-accent-ink",
  secondary: "border border-line bg-surface text-ink",
  danger: "bg-danger text-white",
};

export function Button({ variant = "primary", className = "", ...props }: ButtonProps) {
  return (
    <button
      className={`inline-flex items-center justify-center rounded-[var(--radius)] px-4 py-2 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-50 ${buttonStyles[variant]} ${className}`}
      {...props}
    />
  );
}

type FieldProps = {
  label: string;
  name: string;
  error?: string;
} & InputHTMLAttributes<HTMLInputElement>;

export function TextField({ label, name, error, id, ...props }: FieldProps) {
  const fieldId = id ?? name;
  const errorId = error ? `${fieldId}-error` : undefined;
  return (
    <label className="grid gap-1 text-sm" htmlFor={fieldId}>
      <span className="font-medium">{label}</span>
      <input
        id={fieldId}
        name={name}
        aria-invalid={error ? true : undefined}
        aria-describedby={errorId}
        className="rounded-[var(--radius)] border border-line bg-surface px-3 py-2 text-ink outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
        {...props}
      />
      {error ? (
        <span id={errorId} className="text-danger">
          {error}
        </span>
      ) : null}
    </label>
  );
}

type SelectProps = {
  label: string;
  name: string;
  children: ReactNode;
} & SelectHTMLAttributes<HTMLSelectElement>;

export function SelectField({ label, name, children, id, ...props }: SelectProps) {
  const fieldId = id ?? name;
  return (
    <label className="grid gap-1 text-sm" htmlFor={fieldId}>
      <span className="font-medium">{label}</span>
      <select
        id={fieldId}
        name={name}
        className="rounded-[var(--radius)] border border-line bg-surface px-3 py-2 text-ink outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
        {...props}
      >
        {children}
      </select>
    </label>
  );
}

export function Alert({
  tone = "danger",
  children,
}: {
  tone?: "danger" | "ok" | "warn";
  children: ReactNode;
}) {
  const tones = {
    danger: "bg-danger-bg text-danger",
    ok: "bg-ok-bg text-ok",
    warn: "bg-warn-bg text-warn",
  };
  return (
    <div role="alert" className={`rounded-[var(--radius)] px-3 py-2 text-sm ${tones[tone]}`}>
      {children}
    </div>
  );
}

export function Badge({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex rounded-full border border-line bg-surface px-2 py-0.5 text-xs font-medium">
      {children}
    </span>
  );
}

export function EmptyState({ title, body }: { title: string; body?: string }) {
  return (
    <div className="rounded-[var(--radius)] border border-dashed border-line bg-surface px-4 py-8 text-center">
      <p className="font-medium">{title}</p>
      {body ? <p className="mt-1 text-sm text-muted">{body}</p> : null}
    </div>
  );
}

export function Shell({
  title,
  tenantName,
  locationName,
  nav,
  children,
}: {
  title: string;
  tenantName?: string;
  locationName?: string;
  nav?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted">{title}</p>
            <p className="text-lg font-semibold">
              {tenantName ?? "Masulino"}
              {locationName ? ` · ${locationName}` : ""}
            </p>
          </div>
          {nav}
        </div>
      </header>
      <main className="mx-auto grid max-w-6xl gap-6 px-4 py-6">{children}</main>
    </div>
  );
}
