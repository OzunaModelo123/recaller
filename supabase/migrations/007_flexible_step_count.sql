-- Relax step_number constraints from fixed 1-4 to flexible 1-10.
-- AI suggests optimal step count based on content complexity; admins can adjust.

alter table public.plan_steps
  drop constraint if exists plan_steps_step_number_check;

alter table public.plan_steps
  add constraint plan_steps_step_number_check
  check (step_number between 1 and 10);

-- Also drop the unique constraint on (plan_id, step_number) and re-add it
-- (the unique constraint itself is fine — just the check range changes)

alter table public.step_completions
  drop constraint if exists step_completions_step_number_check;

alter table public.step_completions
  add constraint step_completions_step_number_check
  check (step_number between 1 and 10);
