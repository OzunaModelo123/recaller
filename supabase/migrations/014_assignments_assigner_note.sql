-- Optional message from admin/manager shown to the assignee on My Plans and the assignment view.
alter table public.assignments
  add column if not exists assigner_note text;

comment on column public.assignments.assigner_note is
  'Shown to the employee for this assignment (e.g. context or priorities).';
