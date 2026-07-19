import type { InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from "react";

export function FieldLabel({
  children,
  htmlFor,
  hint,
}: {
  children: ReactNode;
  htmlFor?: string;
  hint?: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="type-heading">
        {children}
      </label>
      {hint ? <p className="type-caption">{hint}</p> : null}
    </div>
  );
}

export function TextInput({
  className = "",
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={`ui-input px-[var(--input-padding-x)] py-[var(--input-padding-y)] type-body ${className}`.trim()}
      {...props}
    />
  );
}

export function TextArea({
  className = "",
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={`ui-input resize-y px-[var(--input-padding-x)] py-3 type-body-lg ${className}`.trim()}
      {...props}
    />
  );
}

export function FieldError({ children }: { children: ReactNode }) {
  if (!children) {
    return null;
  }

  return <p className="ui-alert-danger">{children}</p>;
}

export function FieldDivider() {
  return <div className="ui-divider" />;
}

export function ChipButton({
  active,
  onClick,
  children,
  className = "",
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-active={active ? "true" : "false"}
      className={`ui-chip ${className}`.trim()}
    >
      {children}
    </button>
  );
}
