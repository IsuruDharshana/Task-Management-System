-- =========================================================
-- Migration 004: Notifications Phase 1
-- Adds real-time notification fields and indexes without
-- removing older related_project_id / related_task_id columns.
-- =========================================================

create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references app_users(id),
  type text not null,
  title text not null,
  message text not null,
  entity_type text null,
  entity_id uuid null,
  metadata jsonb not null default '{}'::jsonb,
  read_at timestamptz null,
  created_at timestamptz not null default now()
);

alter table notifications
  add column if not exists entity_type text null;

alter table notifications
  add column if not exists entity_id uuid null;

alter table notifications
  add column if not exists metadata jsonb not null default '{}'::jsonb;

alter table notifications
  drop constraint if exists notifications_type_check;

alter table notifications
  add constraint notifications_type_check
  check (
    type in (
      'task_assigned',
      'task_updated',
      'task_status_changed',
      'comment_added',
      'deadline_approaching',
      'admin_update',
      'project_updated'
    )
  );

create index if not exists notifications_user_created_idx
  on notifications (user_id, created_at desc);

create index if not exists notifications_user_read_idx
  on notifications (user_id, read_at);

create index if not exists notifications_entity_idx
  on notifications (entity_type, entity_id);

notify pgrst, 'reload schema';
