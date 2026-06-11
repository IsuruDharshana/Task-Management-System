-- =========================================================
-- Migration 003: Task Management Schema Cleanup
-- Prepares task-related tables for safe backend implementation.
--
-- Goals:
-- 1. Fix task_assignees soft-remove uniqueness.
-- 2. Add audit columns needed for task updates/deletes.
-- 3. Add non-empty validation constraints.
-- 4. Add indexes for task filtering, sorting, assignment lookup,
--    comments, attachments, notifications, and activity logs.
-- 5. Keep migration additive and safe for existing data.
-- =========================================================

-- =========================
-- TASKS: audit columns
-- =========================

alter table tasks
  add column if not exists updated_by uuid references app_users(id);

alter table tasks
  add column if not exists deleted_by uuid references app_users(id);

alter table tasks
  add column if not exists deleted_reason text;

-- =========================
-- TASKS: validation constraints
-- =========================

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'chk_tasks_title_not_empty'
  ) then
    alter table tasks
      add constraint chk_tasks_title_not_empty
      check (char_length(trim(title)) > 0);
  end if;
end $$;

-- =========================
-- TASK ASSIGNEES: soft-remove audit columns
-- =========================

alter table task_assignees
  add column if not exists removed_by uuid references app_users(id);

alter table task_assignees
  add column if not exists removed_reason text;

-- Drop old hard uniqueness constraint if it exists.
-- The old unique(task_id, user_id) blocks reassigning a user after soft removal.
alter table task_assignees
  drop constraint if exists task_assignees_task_id_user_id_key;

-- Active assignment uniqueness:
-- Same user cannot be actively assigned twice to the same task,
-- but can be reassigned later after removed_at is set.
create unique index if not exists uq_task_assignees_active
  on task_assignees (task_id, user_id)
  where removed_at is null;

-- =========================
-- TASK COMMENTS: audit + validation
-- =========================

alter table task_comments
  add column if not exists deleted_by uuid references app_users(id);

alter table task_comments
  add column if not exists deleted_reason text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'chk_task_comments_comment_text_not_empty'
  ) then
    alter table task_comments
      add constraint chk_task_comments_comment_text_not_empty
      check (char_length(trim(comment_text)) > 0);
  end if;
end $$;

-- =========================
-- TASK ATTACHMENTS: audit + validation
-- =========================

alter table task_attachments
  add column if not exists deleted_by uuid references app_users(id);

alter table task_attachments
  add column if not exists deleted_reason text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'chk_task_attachments_file_name_not_empty'
  ) then
    alter table task_attachments
      add constraint chk_task_attachments_file_name_not_empty
      check (char_length(trim(file_name)) > 0);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'chk_task_attachments_file_path_not_empty'
  ) then
    alter table task_attachments
      add constraint chk_task_attachments_file_path_not_empty
      check (char_length(trim(file_path)) > 0);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'chk_task_attachments_file_size_non_negative'
  ) then
    alter table task_attachments
      add constraint chk_task_attachments_file_size_non_negative
      check (file_size is null or file_size >= 0);
  end if;
end $$;

-- =========================
-- TASK INDEXES
-- =========================

create index if not exists idx_tasks_project_id
  on tasks (project_id);

create index if not exists idx_tasks_created_by
  on tasks (created_by);

create index if not exists idx_tasks_updated_by
  on tasks (updated_by);

create index if not exists idx_tasks_status
  on tasks (status);

create index if not exists idx_tasks_priority
  on tasks (priority);

create index if not exists idx_tasks_due_date
  on tasks (due_date);

create index if not exists idx_tasks_deleted_at
  on tasks (deleted_at);

create index if not exists idx_tasks_project_active
  on tasks (project_id, status, priority, due_date)
  where deleted_at is null;

-- =========================
-- TASK ASSIGNEE INDEXES
-- =========================

create index if not exists idx_task_assignees_task_id
  on task_assignees (task_id);

create index if not exists idx_task_assignees_user_id
  on task_assignees (user_id);

create index if not exists idx_task_assignees_removed_at
  on task_assignees (removed_at);

create index if not exists idx_task_assignees_active_task
  on task_assignees (task_id)
  where removed_at is null;

create index if not exists idx_task_assignees_active_user
  on task_assignees (user_id)
  where removed_at is null;

-- =========================
-- TASK COMMENT INDEXES
-- =========================

create index if not exists idx_task_comments_task_id
  on task_comments (task_id);

create index if not exists idx_task_comments_user_id
  on task_comments (user_id);

create index if not exists idx_task_comments_deleted_at
  on task_comments (deleted_at);

create index if not exists idx_task_comments_task_active
  on task_comments (task_id, created_at)
  where deleted_at is null;

-- =========================
-- TASK ATTACHMENT INDEXES
-- =========================

create index if not exists idx_task_attachments_task_id
  on task_attachments (task_id);

create index if not exists idx_task_attachments_uploaded_by
  on task_attachments (uploaded_by);

create index if not exists idx_task_attachments_deleted_at
  on task_attachments (deleted_at);

create index if not exists idx_task_attachments_task_active
  on task_attachments (task_id, created_at)
  where deleted_at is null;

-- =========================
-- NOTIFICATION INDEXES
-- =========================

create index if not exists idx_notifications_user_id
  on notifications (user_id);

create index if not exists idx_notifications_read_at
  on notifications (read_at);

create index if not exists idx_notifications_type
  on notifications (type);

create index if not exists idx_notifications_related_project_id
  on notifications (related_project_id);

create index if not exists idx_notifications_related_task_id
  on notifications (related_task_id);

create index if not exists idx_notifications_user_unread
  on notifications (user_id, created_at desc)
  where read_at is null;

-- =========================
-- ACTIVITY LOG INDEXES
-- =========================

create index if not exists idx_activity_logs_actor_user_id
  on activity_logs (actor_user_id);

create index if not exists idx_activity_logs_entity
  on activity_logs (entity_type, entity_id);

create index if not exists idx_activity_logs_created_at
  on activity_logs (created_at);

-- =========================
-- Reload PostgREST schema cache
-- =========================

notify pgrst, 'reload schema';