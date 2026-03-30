-- Bot tokens must not be readable via the Supabase anon/authenticated client (only service_role).
-- Admins see connection status via organisations.slack_team_id, not this table.
drop policy if exists "slack_installations_org_admin_select" on public.slack_installations;
