-- Create initial application admin user.
-- IMPORTANT:
-- 1. Generate a bcrypt hash in Node.js.
-- 2. Replace CHANGE_ME_BCRYPT_HASH before executing.
-- 3. Execute connected as OPERA_CFG_APP.

INSERT INTO opera_cfg_users (
    username,
    password_hash,
    full_name,
    email,
    status,
    created_by
) VALUES (
    'admin',
    'CHANGE_ME_BCRYPT_HASH',
    'Application Administrator',
    'admin@example.com',
    'ACTIVE',
    'seed_002_create_admin_user'
);

INSERT INTO opera_cfg_user_roles (user_id, role_id, assigned_by)
SELECT u.user_id, r.role_id, 'seed_002_create_admin_user'
FROM opera_cfg_users u
JOIN opera_cfg_roles r ON r.role_code = 'ADMIN'
WHERE u.username = 'admin';

COMMIT;
