import type { SelectHTMLAttributes } from "react";

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  helperText?: string;
  errorText?: string;
}

export default function Select({
  id,
  label,
  helperText,
  errorText,
  className = "",
  children,
  ...props
}: SelectProps) {
  return (
    <div className="veyra-field">
      {label && <label htmlFor={id}>{label}</label>}
      <select id={id} className={`veyra-select ${className}`.trim()} aria-invalid={Boolean(errorText)} {...props}>
        {children}
      </select>
      {errorText ? <p className="veyra-field-error">{errorText}</p> : helperText ? <p className="veyra-field-help">{helperText}</p> : null}
    </div>
  );
}
