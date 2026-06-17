import type { ReactNode } from "react";
import Button from "./Button";

interface ModalProps {
  title: string;
  description?: string;
  children: ReactNode;
  onClose: () => void;
  footer?: ReactNode;
}

export default function Modal({ title, description, children, onClose, footer }: ModalProps) {
  return (
    <div className="veyra-modal-backdrop" role="presentation">
      <div className="veyra-modal" role="dialog" aria-modal="true" aria-labelledby="veyra-modal-title">
        <div className="veyra-modal-header">
          <div>
            <h2 id="veyra-modal-title">{title}</h2>
            {description && <p>{description}</p>}
          </div>
          <Button type="button" variant="ghost" onClick={onClose} aria-label="Close modal">
            Close
          </Button>
        </div>
        <div className="veyra-modal-body">{children}</div>
        {footer && <div className="veyra-modal-footer">{footer}</div>}
      </div>
    </div>
  );
}
