-- =========================================================
-- Migration 002: Project Management Module
-- Updates existing projects and project_members tables.
-- Adds soft-delete/audit columns, safer member uniqueness,
-- constraints, and indexes.
-- =========================================================

-- =========================
-- PROJECTS
-- =========================

alter table projects
  alter column name type varchar(150);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'chk_projects_name_not_empty'
  ) then
    alter table projects
      add constraint chk_projects_name_not_empty
      check (char_length(trim(name)) > 0);
  end if;
end $$;

-- Rename end_date to due_date only if needed
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'projects'
      and column_name = 'end_date'
  )
  and not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'projects'
      and column_name = 'due_date'
  ) then
    alter table projects rename column end_date to due_date;
  end if;
end $$;

alter table projects
  add column if not exists updated_by uuid references app_users(id);

alter table projects
  add column if not exists deleted_by uuid references app_users(id);

alter table projects
  add column if not exists deleted_reason text;

-- =========================
-- PROJECT MEMBERS
-- =========================

alter table project_members
  alter column project_label type varchar(100);

alter table project_members
  alter column added_by set not null;

alter table project_members
  add column if not exists removed_by uuid references app_users(id);

alter table project_members
  add column if not exists removed_reason text;

-- Drop old simple unique constraint; active-member uniqueness is handled by partial index.
alter table project_members
  drop constraint if exists project_members_project_id_user_id_key;

create unique index if not exists uq_project_members_active
  on project_members (project_id, user_id)
  where removed_at is null;

-- =========================
-- INDEXES
-- =========================

create index if not exists idx_projects_created_by
  on projects (created_by);

create index if not exists idx_projects_deleted_at
  on projects (deleted_at);

create index if not exists idx_pm_project_id
  on project_members (project_id);

create index if not exists idx_pm_user_id
  on project_members (user_id);

create index if not exists idx_pm_project_role
  on project_members (project_role);

create index if not exists idx_pm_removed_at
  on project_members (removed_at);

-- =========================
-- Reload PostgREST schema cache
-- =========================

notify pgrst, 'reload schema';