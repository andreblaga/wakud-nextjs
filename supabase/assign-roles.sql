-- ============================================================================
-- ASSIGN ROLES TO USERS
-- ============================================================================
-- Run this in the Supabase SQL Editor AFTER you have created your users in
-- Authentication -> Users. It matches each user by email and gives them a role.
--
-- Valid roles: 'gm', 'operations', 'sales', 'finance'
--   gm         = General Manager (full access)
--   operations = production & stock
--   sales      = deals & contracts
--   finance    = invoices & exports
--
-- Edit the email/role pairs below to match the users you created, then Run.
-- Safe to re-run: it updates the role if the user already has one.
-- ============================================================================

INSERT INTO public.user_roles (user_id, role)
SELECT u.id, v.role
FROM auth.users u
JOIN (VALUES
    ('gm@yourcompany.com',        'gm'),
    ('ops@yourcompany.com',       'operations'),
    ('sales@yourcompany.com',     'sales'),
    ('finance@yourcompany.com',   'finance')
) AS v(email, role) ON lower(u.email) = lower(v.email)
ON CONFLICT (user_id) DO UPDATE SET role = EXCLUDED.role;

-- Check the result:
SELECT u.email, r.role
FROM public.user_roles r
JOIN auth.users u ON u.id = r.user_id
ORDER BY u.email;
