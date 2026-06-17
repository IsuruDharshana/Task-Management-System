import Button from "./Button";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "default";
  isLoading?: boolean;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
}

export default function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "default",
  isLoading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!open) return null;

  return (
    <div className="veyra-confirm-backdrop" role="presentation">
      <div className="veyra-confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="confirm-dialog-title">
        <div className={`veyra-confirm-icon ${variant === "danger" ? "danger" : ""}`} aria-hidden="true">
          {variant === "danger" ? "!" : "i"}
        </div>
        <div>
          <h2 id="confirm-dialog-title">{title}</h2>
          <p>{description}</p>
        </div>
        <div className="veyra-confirm-actions">
          <Button type="button" variant="secondary" onClick={onCancel} disabled={isLoading}>
            {cancelLabel}
          </Button>
          <Button type="button" variant={variant === "danger" ? "danger" : "primary"} onClick={onConfirm} disabled={isLoading}>
            {isLoading ? `${confirmLabel.replace(/\?$/, "")}...` : confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
