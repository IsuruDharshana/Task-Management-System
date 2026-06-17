import type { HTMLAttributes, ReactNode } from "react";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  title?: string;
  description?: string;
  actions?: ReactNode;
}

export default function Card({
  title,
  description,
  actions,
  className = "",
  children,
  ...props
}: CardProps) {
  return (
    <section className={`veyra-card ${className}`.trim()} {...props}>
      {(title || description || actions) && (
        <div className="veyra-card-header">
          <div>
            {title && <h2>{title}</h2>}
            {description && <p>{description}</p>}
          </div>
          {actions && <div className="veyra-card-actions">{actions}</div>}
        </div>
      )}
      {children}
    </section>
  );
}
