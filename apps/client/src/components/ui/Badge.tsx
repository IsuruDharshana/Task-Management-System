import type { HTMLAttributes } from "react";

type BadgeVariant =
  | "default"
  | "admin"
  | "project_manager"
  | "collaborator"
  | "active"
  | "inactive"
  | "to_do"
  | "in_progress"
  | "completed"
  | "archived"
  | "low"
  | "medium"
  | "high"
  | "overdue"
  | "due_soon";

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

export default function Badge({ variant = "default", className = "", children, ...props }: BadgeProps) {
  return (
    <span className={`veyra-badge veyra-badge-${variant} ${className}`.trim()} {...props}>
      {children}
    </span>
  );
}
