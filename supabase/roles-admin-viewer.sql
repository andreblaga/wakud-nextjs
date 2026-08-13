-- Add two roles to WakudOS: 'admin' (superuser, above GM) and
-- 'executive_viewer' (read-only across all modules, for the Utopia execs).
--
-- has_role(_user_id, _role) is generic and needs NO change — it matches any
-- role string in user_roles. The only blocker is the CHECK constraint below,
-- which currently hard-codes the original four roles.
--
-- App-side gates (lib/permissions.ts Role union + labels + write domains,
-- RoleGate, and trimming GM's system powers) are handled separately by Claude
-- Code and must use these exact slugs: 'admin', 'executive_viewer'.
--
-- Idempotent: safe to run more than once.

ALTER TABLE public.user_roles DROP CONSTRAINT IF EXISTS user_roles_role_check;

ALTER TABLE public.user_roles ADD CONSTRAINT user_roles_role_check
  CHECK (role IN ('admin','executive_viewer','gm','operations','sales','finance'));

-- Verify:
--   SELECT pg_get_constraintdef(oid) FROM pg_constraint
--   WHERE conrelid = 'public.user_roles'::regclass AND contype = 'c';
