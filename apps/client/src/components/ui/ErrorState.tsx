import type { ReactNode } from "react";
import Button from "./Button";

interface ErrorStateProps {
  title?: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  children?: ReactNode;
}

export default function ErrorState({
  title = "Something went wrong",
  message,
  actionLabel,
  onAction,
  children,
}: ErrorStateProps) {
  return (
    <div className="veyra-error-state">
      <div className="veyra-error-icon" aria-hidden="true">!</div>
      <h2>{title}</h2>
      <p>{message}</p>
      {onAction && actionLabel && (
        <Button type="button" variant="secondary" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
      {children}
    </div>
  );
}
