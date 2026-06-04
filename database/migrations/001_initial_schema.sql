-- Initial Database Schema

create extension if not exists "pgcrypto";

-- =========================
-- USERS
-- =========================

create table if not exists app_users (
    id uuid primary key default gen_random_uuid(),

    name text not null,
    email text not null unique,
    password_hash text not null,

    role text not null check (
        role in ('admin', 'project_manager', 'collaborator')
    ),

    is_active boolean not null default true,
    must_reset_password boolean not null default true,

    token_version integer not null default 1,

    last_login_at timestamptz,

    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    deleted_at timestamptz
);

-- =========================
-- PROJECTS
-- =========================

create table if not exists projects (
    id uuid primary key default gen_random_uuid(),

    name text not null,
    description text,

    created_by uuid not null references app_users(id),

    status text not null default 'active' check (
        status in ('active', 'completed', 'archived')
    ),

    start_date date,
    end_date date,

    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    deleted_at timestamptz,

    check (
        end_date is null
        or start_date is null
        or end_date >= start_date
    )
);

-- =========================
-- PROJECT MEMBERS
-- =========================

create table if not exists project_members (
    id uuid primary key default gen_random_uuid(),

    project_id uuid not null references projects(id),
    user_id uuid not null references app_users(id),

    project_role text not null check (
        project_role in ('project_manager', 'collaborator')
    ),

    project_label text,

    added_by uuid references app_users(id),

    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    removed_at timestamptz,

    unique (project_id, user_id)
);

-- =========================
-- TASKS
-- =========================

create table if not exists tasks (
    id uuid primary key default gen_random_uuid(),

    project_id uuid not null references projects(id),
    created_by uuid not null references app_users(id),

    title text not null,
    description text,

    priority text not null default 'medium' check (
        priority in ('low', 'medium', 'high')
    ),

    status text not null default 'to_do' check (
        status in ('to_do', 'in_progress', 'completed')
    ),

    due_date date,
    completed_at timestamptz,

    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    deleted_at timestamptz
);

-- =========================
-- TASK ASSIGNEES
-- =========================

create table if not exists task_assignees (
    id uuid primary key default gen_random_uuid(),

    task_id uuid not null references tasks(id),
    user_id uuid not null references app_users(id),
    assigned_by uuid references app_users(id),

    assigned_at timestamptz not null default now(),
    removed_at timestamptz,

    unique (task_id, user_id)
);

-- =========================
-- TASK COMMENTS
-- =========================

create table if not exists task_comments (
    id uuid primary key default gen_random_uuid(),

    task_id uuid not null references tasks(id),
    user_id uuid not null references app_users(id),

    comment_text text not null,

    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    deleted_at timestamptz
);

-- =========================
-- TASK ATTACHMENTS
-- =========================

create table if not exists task_attachments (
    id uuid primary key default gen_random_uuid(),

    task_id uuid not null references tasks(id),
    uploaded_by uuid not null references app_users(id),

    file_name text not null,
    file_path text not null,
    file_type text,
    file_size integer,

    created_at timestamptz not null default now(),
    deleted_at timestamptz
);

-- =========================
-- NOTIFICATIONS
-- =========================

create table if not exists notifications (
    id uuid primary key default gen_random_uuid(),

    user_id uuid not null references app_users(id),

    type text not null check (
        type in (
            'task_assigned',
            'task_status_changed',
            'comment_added',
            'deadline_approaching',
            'admin_update'
        )
    ),

    title text not null,
    message text not null,

    related_project_id uuid references projects(id),
    related_task_id uuid references tasks(id),

    read_at timestamptz,
    created_at timestamptz not null default now()
);

-- =========================
-- ACTIVITY LOGS
-- =========================

create table if not exists activity_logs (
    id uuid primary key default gen_random_uuid(),

    actor_user_id uuid references app_users(id),

    action text not null,
    entity_type text not null,
    entity_id uuid,

    metadata jsonb,

    created_at timestamptz not null default now()
);

-- =========================
-- SYSTEM SETTINGS
-- =========================

create table if not exists system_settings (
    id uuid primary key default gen_random_uuid(),

    setting_key text not null unique,
    setting_value text,
    description text,

    updated_at timestamptz not null default now(),
    updated_by uuid references app_users(id)
);