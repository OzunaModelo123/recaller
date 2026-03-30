-- Trackable steps: evidence expectations per step; structured evidence on completion.

alter table public.plan_steps
  add column if not exists proof_type text not null default 'text';

alter table public.plan_steps
  drop constraint if exists plan_steps_proof_type_check;

alter table public.plan_steps
  add constraint plan_steps_proof_type_check
  check (
    proof_type in (
      'none',
      'text',
      'link',
      'text_and_link',
      'file',
      'screenshot'
    )
  );

alter table public.plan_steps
  add column if not exists proof_instructions text not null default '';

alter table public.step_completions
  add column if not exists evidence jsonb not null default '{}'::jsonb;

-- Keep a single row per assignment step (drops older duplicates if any)
delete from public.step_completions a
  using public.step_completions b
 where a.id > b.id
   and a.assignment_id = b.assignment_id
   and a.step_number = b.step_number;

create unique index if not exists step_completions_assignment_step_unique
  on public.step_completions (assignment_id, step_number);
