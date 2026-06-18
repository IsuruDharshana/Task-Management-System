type SkeletonBlockProps = {
  className?: string;
  width?: string;
  height?: string;
  rounded?: "sm" | "md" | "lg" | "pill";
};

type SkeletonCollectionProps = {
  count?: number;
};

const roundedClass = {
  sm: "skeleton-rounded-sm",
  md: "skeleton-rounded-md",
  lg: "skeleton-rounded-lg",
  pill: "skeleton-rounded-pill",
};

export function SkeletonBlock({ className = "", width, height, rounded = "md" }: SkeletonBlockProps) {
  return (
    <span
      className={`skeleton-block ${roundedClass[rounded]} ${className}`.trim()}
      style={{ width, height }}
      aria-hidden="true"
    />
  );
}

export function SkeletonStatCards({ count = 4 }: SkeletonCollectionProps) {
  return (
    <div className="skeleton-stat-grid" aria-label="Loading summary" aria-busy="true">
      {Array.from({ length: count }).map((_, index) => (
        <article key={index} className="skeleton-card skeleton-stat-card">
          <div className="skeleton-row skeleton-row-between">
            <SkeletonBlock width="42%" height="14px" />
            <SkeletonBlock width="38px" height="38px" rounded="lg" />
          </div>
          <div>
            <SkeletonBlock width="56px" height="34px" />
            <SkeletonBlock className="skeleton-space-top" width="72%" height="13px" />
          </div>
        </article>
      ))}
    </div>
  );
}

export function SkeletonDashboard() {
  return (
    <section className="dashboard-page veyra-page skeleton-page" aria-label="Loading dashboard" aria-busy="true">
      <SkeletonHeaderSection />
      <SkeletonStatCards count={4} />
      <div className="dashboard-work-grid">
        <section className="skeleton-card skeleton-panel">
          <SkeletonBlock width="180px" height="22px" />
          <SkeletonList count={4} />
        </section>
        <aside className="dashboard-side-stack">
          <section className="skeleton-card skeleton-panel">
            <SkeletonBlock width="140px" height="20px" />
            <SkeletonList count={3} compact />
          </section>
          <section className="skeleton-card skeleton-panel">
            <SkeletonBlock width="150px" height="20px" />
            <SkeletonList count={4} compact />
          </section>
        </aside>
      </div>
    </section>
  );
}

export function SkeletonAppShell() {
  return (
    <div className="skeleton-app-shell" aria-label="Loading workspace" aria-busy="true">
      <aside className="skeleton-sidebar">
        <SkeletonBlock width="130px" height="28px" />
        {Array.from({ length: 5 }).map((_, index) => (
          <SkeletonBlock key={index} width={index === 0 ? "88%" : "72%"} height="40px" rounded="lg" />
        ))}
      </aside>
      <main className="skeleton-app-main">
        <SkeletonHeaderSection />
        <SkeletonStatCards count={4} />
        <div className="dashboard-work-grid">
          <section className="skeleton-card skeleton-panel">
            <SkeletonBlock width="180px" height="22px" />
            <SkeletonList count={4} />
          </section>
          <section className="skeleton-card skeleton-panel">
            <SkeletonBlock width="150px" height="22px" />
            <SkeletonList count={3} compact />
          </section>
        </div>
      </main>
    </div>
  );
}

export function SkeletonHeaderSection() {
  return (
    <div className="skeleton-header">
      <div>
        <SkeletonBlock width="260px" height="32px" />
        <SkeletonBlock className="skeleton-space-top" width="420px" height="15px" />
      </div>
      <SkeletonBlock width="120px" height="44px" rounded="lg" />
    </div>
  );
}

export function SkeletonProjectDetails() {
  return (
    <section className="project-details-page veyra-page skeleton-page" aria-label="Loading project details" aria-busy="true">
      <SkeletonHeaderSection />
      <div className="project-summary-grid">
        <section className="skeleton-card skeleton-panel">
          <SkeletonBlock width="160px" height="22px" />
          <SkeletonBlock className="skeleton-space-top" width="90%" height="14px" />
          <SkeletonBlock className="skeleton-space-top" width="70%" height="14px" />
          <div className="skeleton-meta-grid">
            <SkeletonBlock height="56px" rounded="lg" />
            <SkeletonBlock height="56px" rounded="lg" />
            <SkeletonBlock height="56px" rounded="lg" />
          </div>
        </section>
        <section className="skeleton-card skeleton-panel">
          <SkeletonBlock width="180px" height="22px" />
          <SkeletonList count={3} compact />
        </section>
      </div>
      <SkeletonStatCards count={5} />
      <section className="skeleton-card skeleton-panel">
        <SkeletonBlock width="210px" height="24px" />
        <SkeletonFilterBar />
        <SkeletonTable rows={6} columns={8} />
      </section>
    </section>
  );
}

export function SkeletonProjectGrid({ count = 6 }: SkeletonCollectionProps) {
  return (
    <div className="projects-grid modern-projects-grid" aria-label="Loading projects" aria-busy="true">
      {Array.from({ length: count }).map((_, index) => (
        <article key={index} className="skeleton-card skeleton-project-card">
          <div className="skeleton-row skeleton-row-between">
            <SkeletonBlock width="84px" height="24px" rounded="pill" />
            <SkeletonBlock width="112px" height="13px" />
          </div>
          <SkeletonBlock width="72%" height="24px" />
          <SkeletonBlock width="100%" height="13px" />
          <SkeletonBlock width="82%" height="13px" />
          <SkeletonBlock width="100%" height="10px" rounded="pill" />
          <div className="skeleton-row skeleton-row-between">
            <SkeletonBlock width="42%" height="48px" rounded="lg" />
            <SkeletonBlock width="42%" height="48px" rounded="lg" />
          </div>
        </article>
      ))}
    </div>
  );
}

export function SkeletonFilterBar({ count = 7 }: SkeletonCollectionProps) {
  return (
    <div className="skeleton-filter-bar" aria-hidden="true">
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className={index === 0 ? "skeleton-filter skeleton-filter-search" : "skeleton-filter"}>
          <SkeletonBlock width={index === 0 ? "72px" : "54px"} height="12px" />
          <SkeletonBlock width="100%" height="44px" rounded="lg" />
        </div>
      ))}
      <SkeletonBlock width="96px" height="44px" rounded="lg" />
    </div>
  );
}

export function SkeletonTable({ rows = 6, columns = 6 }: { rows?: number; columns?: number }) {
  return (
    <div className="skeleton-table" aria-label="Loading table" aria-busy="true">
      <div className="skeleton-table-row skeleton-table-head" style={{ gridTemplateColumns: `repeat(${columns}, minmax(90px, 1fr))` }}>
        {Array.from({ length: columns }).map((_, index) => (
          <SkeletonBlock key={index} width={index === 0 ? "70%" : "54%"} height="13px" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div key={rowIndex} className="skeleton-table-row" style={{ gridTemplateColumns: `repeat(${columns}, minmax(90px, 1fr))` }}>
          {Array.from({ length: columns }).map((_, colIndex) => (
            <SkeletonBlock key={colIndex} width={`${colIndex === 0 ? 82 : 42 + ((rowIndex + colIndex) % 4) * 12}%`} height="14px" />
          ))}
        </div>
      ))}
    </div>
  );
}

export function SkeletonKanban() {
  return (
    <div className="kanban-board project-task-kanban skeleton-kanban" aria-label="Loading Kanban board" aria-busy="true">
      {["To Do", "In Progress", "Completed"].map((label) => (
        <section key={label} className="kanban-column skeleton-kanban-column">
          <div className="kanban-column-header">
            <SkeletonBlock width="110px" height="18px" />
            <SkeletonBlock width="28px" height="28px" rounded="pill" />
          </div>
          <div className="kanban-task-list">
            {Array.from({ length: 3 }).map((_, index) => (
              <article key={index} className="skeleton-card skeleton-kanban-card">
                <div className="skeleton-row skeleton-row-between">
                  <SkeletonBlock width="76px" height="24px" rounded="pill" />
                  <SkeletonBlock width="92px" height="24px" rounded="pill" />
                </div>
                <SkeletonBlock width="90%" height="18px" />
                <SkeletonBlock width="70%" height="13px" />
                <SkeletonBlock width="96px" height="28px" rounded="pill" />
              </article>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

export function SkeletonList({ count = 5, compact = false }: SkeletonCollectionProps & { compact?: boolean }) {
  return (
    <div className={compact ? "skeleton-list compact" : "skeleton-list"} aria-label="Loading list" aria-busy="true">
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="skeleton-list-item">
          <SkeletonBlock width={compact ? "28px" : "36px"} height={compact ? "28px" : "36px"} rounded="pill" />
          <div>
            <SkeletonBlock width={`${72 - (index % 3) * 12}%`} height="15px" />
            <SkeletonBlock className="skeleton-space-top-sm" width={`${48 + (index % 2) * 20}%`} height="12px" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function SkeletonNotificationList({ count = 4 }: SkeletonCollectionProps) {
  return <SkeletonList count={count} compact />;
}

export function SkeletonComments({ count = 3 }: SkeletonCollectionProps) {
  return <SkeletonList count={count} />;
}
