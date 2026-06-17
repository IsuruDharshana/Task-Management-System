type StatIconName = "total" | "todo" | "progress" | "completed" | "overdue";

interface StatIconProps {
  name: StatIconName;
}

function StatIconSvg({ name }: StatIconProps) {
  const commonProps = {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };

  switch (name) {
    case "todo":
      return (
        <svg {...commonProps}>
          <circle cx="12" cy="12" r="8" />
        </svg>
      );
    case "progress":
      return (
        <svg {...commonProps}>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 2" />
        </svg>
      );
    case "completed":
      return (
        <svg {...commonProps}>
          <circle cx="12" cy="12" r="9" />
          <path d="M8 12l2.5 2.5L16 9" />
        </svg>
      );
    case "overdue":
      return (
        <svg {...commonProps}>
          <path d="M12 3l9 16H3L12 3z" />
          <path d="M12 9v4" />
          <path d="M12 17h.01" />
        </svg>
      );
    case "total":
    default:
      return (
        <svg {...commonProps}>
          <path d="M9 5h6" />
          <path d="M9 11h6" />
          <path d="M9 17h4" />
          <rect x="5" y="3" width="14" height="18" rx="2" />
        </svg>
      );
  }
}

export default function StatIcon({ name }: StatIconProps) {
  return (
    <span className={`stat-card-icon stat-icon stat-icon-${name}`} aria-hidden="true">
      <StatIconSvg name={name} />
    </span>
  );
}
