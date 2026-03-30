-- Admin notification channel (read-only completion updates); employee Slack self-link timestamp.
-- slack_installations: single workspace row per org; classify as workspace install.

alter table public.organisations
  add column if not exists slack_admin_channel_id text;

alter table public.users
  add column if not exists slack_employee_linked_at timestamptz;

alter table public.slack_installations
  add column if not exists installation_kind text not null default 'workspace';

alter table public.slack_installations
  drop constraint if exists slack_installations_installation_kind_check;

alter table public.slack_installations
  add constraint slack_installations_installation_kind_check
  check (installation_kind in ('workspace'));

comment on column public.organisations.slack_admin_channel_id is
  'Channel ID (C…) for read-only training completion notices; no interactive buttons.';
comment on column public.users.slack_employee_linked_at is
  'Set when the employee completes Connect Slack OAuth (self-linked Slack user id).';
comment on column public.slack_installations.installation_kind is
  'Workspace bot install; one row per org.';
