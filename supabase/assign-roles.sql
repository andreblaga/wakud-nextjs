-- ============================================================================
-- ASSIGN ROLES TO USERS  (WakudOS)
-- ============================================================================
-- Run in the Supabase SQL Editor AFTER the users exist in Authentication ->
-- Users, and AFTER supabase/roles-admin-viewer.sql has been run (which allows
-- the 'admin' and 'executive_viewer' roles).
--
-- Valid roles: 'admin', 'executive_viewer', 'gm', 'operations', 'sales', 'finance'
--   admin            = superuser: everything incl. user mgmt & system settings
--   executive_viewer = read-only across all modules (oversight)
--   gm               = General Manager (business full-access; no user mgmt/settings)
--   operations       = production & stock
--   sales            = deals & contracts
--   finance          = invoices & exports
--
-- Matches each user by email and assigns their role. Safe to re-run.
-- ============================================================================

INSERT INTO public.user_roles (user_id, role)
SELECT u.id, v.role
FROM auth.users u
JOIN (VALUES
    ('andre@the-utopia.world',    'admin'),
    ('andreblaga@gmail.com',      'admin'),   -- Andre's second login
    ('john@the-utopia.world',     'executive_viewer'),
    ('faris@the-utopia.world',    'executive_viewer'),
    ('yawar@the-utopia.world',    'executive_viewer'),
    ('abdulrahman@wakud.com',     'gm'),
    ('tariq@wakud.com',           'operations'),
    ('salim@wakud.com',           'operations'),
    ('thasleem@wakud.com',        'operations')
) AS v(email, role) ON lower(u.email) = lower(v.email)
ON CONFLICT (user_id) DO UPDATE SET role = EXCLUDED.role;

-- Check the result (also flags anyone in the roster not yet created in Auth):
SELECT u.email, r.role
FROM public.user_roles r
JOIN auth.users u ON u.id = r.user_id
ORDER BY r.role, u.email;
