-- One active assignment per (org, plan, employee). Cancel extras before the unique index.

WITH ranked AS (
  SELECT
    a.id,
    row_number() OVER (
      PARTITION BY a.org_id, a.plan_id, a.assigned_to
      ORDER BY
        (SELECT count(*)::bigint FROM public.step_completions sc WHERE sc.assignment_id = a.id) DESC,
        a.created_at ASC,
        a.id ASC
    ) AS rn
  FROM public.assignments a
  WHERE a.status = 'active'
)
UPDATE public.assignments a
SET status = 'cancelled'
FROM ranked r
WHERE a.id = r.id
  AND r.rn > 1;

create unique index if not exists assignments_one_active_plan_per_employee_idx
  on public.assignments (org_id, plan_id, assigned_to)
  where status = 'active';
