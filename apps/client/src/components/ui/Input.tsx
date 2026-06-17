import type { InputHTMLAttributes, ReactNode } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  helperText?: string;
  errorText?: string;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
}

export default function Input({
  id,
  label,
  helperText,
  errorText,
  leftIcon,
  rightIcon,
  className = "",
  ...props
}: InputProps) {
  return (
    <div className="veyra-field">
      {label && <label htmlFor={id}>{label}</label>}
      <div className={`veyra-input-shell ${leftIcon ? "has-left-icon" : ""} ${rightIcon ? "has-right-icon" : ""}`}>
        {leftIcon && <span className="veyra-input-icon left">{leftIcon}</span>}
        <input id={id} className={`veyra-input ${className}`.trim()} aria-invalid={Boolean(errorText)} {...props} />
        {rightIcon && <span className="veyra-input-icon right">{rightIcon}</span>}
      </div>
      {errorText ? <p className="veyra-field-error">{errorText}</p> : helperText ? <p className="veyra-field-help">{helperText}</p> : null}
    </div>
  );
}
