-- Local development only. Creates the auxiliary databases used by the stack.
-- ems_test is the base connection used to create ephemeral per-run test databases.
CREATE DATABASE ems_test OWNER ems;
CREATE DATABASE keycloak OWNER ems;
ALTER ROLE ems CREATEDB;
