-- Allow all application notification event types.

alter table notifications
  drop constraint if exists notifications_type_check;

alter table notifications
  add constraint notifications_type_check
  check (
    type in (
      'task_created',
      'task_assigned',
      'task_updated',
      'task_status_changed',
      'task_deleted',
      'comment_added',
      'attachment_uploaded',
      'deadline_approaching',
      'admin_update',
      'project_updated',
      'project_deleted',
      'project_member_added',
      'project_member_removed'
    )
  );

notify pgrst, 'reload schema';
