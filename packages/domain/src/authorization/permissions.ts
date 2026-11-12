/**
 * Permission catalog. Permission keys are stable identifiers stored in the `permissions` table.
 * The database is the runtime source of truth for role -> permission mappings; this catalog is the
 * source used by seeds and migrations, and by code that must reference a permission by name.
 */

export type ScopeType = "global" | "organization" | "project";

export interface PermissionDefinition {
  readonly key: string;
  readonly description: string;
  /** Privileged permissions are only usable when the session satisfied MFA. */
  readonly privileged: boolean;
  /** Scope types at which a grant of this permission is meaningful. */
  readonly grantableScopes: readonly ScopeType[];
  /**
   * When true, a project-scoped grant of this permission also applies to the project's owning
   * organization record itself (e.g. a project member may read the customer organization's profile).
   */
  readonly projectGrantAppliesToParentOrganization?: boolean;
}

const def = (
  key: string,
  description: string,
  privileged: boolean,
  grantableScopes: readonly ScopeType[],
  projectGrantAppliesToParentOrganization = false,
): PermissionDefinition => ({
  key,
  description,
  privileged,
  grantableScopes,
  projectGrantAppliesToParentOrganization,
});

export const PERMISSIONS = {
  DASHBOARD_VIEW: "dashboard:view",

  ORGANIZATION_READ: "organization:read",
  ORGANIZATION_CREATE: "organization:create",
  ORGANIZATION_UPDATE: "organization:update",
  ORGANIZATION_ARCHIVE: "organization:archive",

  CONTACT_READ: "contact:read",
  CONTACT_WRITE: "contact:write",

  OPPORTUNITY_READ: "opportunity:read",
  OPPORTUNITY_WRITE: "opportunity:write",

  PROJECT_READ: "project:read",
  PROJECT_CREATE: "project:create",
  PROJECT_UPDATE: "project:update",
  PROJECT_MEMBER_MANAGE: "project:member_manage",

  APPROVAL_EMS_INTERNAL: "approval:ems_internal",
  APPROVAL_CUSTOMER_COMMERCIAL: "approval:customer_commercial",
  APPROVAL_CUSTOMER_TECHNICAL: "approval:customer_technical",

  FINANCE_READ: "finance:read",
  FINANCE_MANAGE: "finance:manage",
  PAYMENT_VERIFY: "payment:verify",

  AGENT_RUN: "agent:run",
  AGENT_REVIEW: "agent:review",

  AUDIT_READ: "audit:read",
  USER_READ: "user:read",
  USER_MANAGE: "user:manage",
  ROLE_MANAGE: "role:manage",
} as const;

export type PermissionKey = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

const P = PERMISSIONS;
const ALL: readonly ScopeType[] = ["global", "organization", "project"];
const GLOBAL_ORG: readonly ScopeType[] = ["global", "organization"];
const GLOBAL: readonly ScopeType[] = ["global"];

export const PERMISSION_DEFINITIONS: Readonly<Record<PermissionKey, PermissionDefinition>> = {
  [P.DASHBOARD_VIEW]: def(P.DASHBOARD_VIEW, "View the dashboard", false, ALL),

  [P.ORGANIZATION_READ]: def(P.ORGANIZATION_READ, "Read organization profiles", false, ALL, true),
  [P.ORGANIZATION_CREATE]: def(P.ORGANIZATION_CREATE, "Create organizations", false, GLOBAL),
  [P.ORGANIZATION_UPDATE]: def(P.ORGANIZATION_UPDATE, "Update organizations", false, GLOBAL_ORG),
  [P.ORGANIZATION_ARCHIVE]: def(
    P.ORGANIZATION_ARCHIVE,
    "Archive/restore organizations",
    true,
    GLOBAL,
  ),

  [P.CONTACT_READ]: def(P.CONTACT_READ, "Read contacts", false, GLOBAL_ORG),
  [P.CONTACT_WRITE]: def(P.CONTACT_WRITE, "Create/update contacts", false, GLOBAL_ORG),

  [P.OPPORTUNITY_READ]: def(P.OPPORTUNITY_READ, "Read opportunities", false, GLOBAL),
  [P.OPPORTUNITY_WRITE]: def(P.OPPORTUNITY_WRITE, "Create/update opportunities", false, GLOBAL),

  [P.PROJECT_READ]: def(P.PROJECT_READ, "Read projects", false, ALL),
  [P.PROJECT_CREATE]: def(P.PROJECT_CREATE, "Create projects", false, GLOBAL),
  [P.PROJECT_UPDATE]: def(P.PROJECT_UPDATE, "Update project plans (not baselines)", false, ALL),
  [P.PROJECT_MEMBER_MANAGE]: def(P.PROJECT_MEMBER_MANAGE, "Manage project members", true, ALL),

  [P.APPROVAL_EMS_INTERNAL]: def(
    P.APPROVAL_EMS_INTERNAL,
    "Level 1 EMS internal authorization",
    true,
    ALL,
  ),
  [P.APPROVAL_CUSTOMER_COMMERCIAL]: def(
    P.APPROVAL_CUSTOMER_COMMERCIAL,
    "Level 2 customer commercial authorization",
    true,
    ["organization", "project"],
  ),
  [P.APPROVAL_CUSTOMER_TECHNICAL]: def(
    P.APPROVAL_CUSTOMER_TECHNICAL,
    "Level 3 customer technical/safety authorization",
    true,
    ["organization", "project"],
  ),

  [P.FINANCE_READ]: def(P.FINANCE_READ, "Read invoices and payments", false, GLOBAL_ORG),
  [P.FINANCE_MANAGE]: def(P.FINANCE_MANAGE, "Prepare invoices and record payments", true, GLOBAL),
  [P.PAYMENT_VERIFY]: def(P.PAYMENT_VERIFY, "Verify payments against evidence", true, GLOBAL),

  [P.AGENT_RUN]: def(P.AGENT_RUN, "Start AI agent runs", false, ALL),
  [P.AGENT_REVIEW]: def(P.AGENT_REVIEW, "Review/approve AI agent proposals", true, ALL),

  [P.AUDIT_READ]: def(P.AUDIT_READ, "Read audit history", true, GLOBAL_ORG),
  [P.USER_READ]: def(P.USER_READ, "Read users", false, GLOBAL_ORG),
  [P.USER_MANAGE]: def(P.USER_MANAGE, "Invite/suspend users", true, GLOBAL),
  [P.ROLE_MANAGE]: def(P.ROLE_MANAGE, "Assign roles", true, GLOBAL),
};

export const ALL_PERMISSION_KEYS: readonly PermissionKey[] = Object.values(PERMISSIONS);

export function isPermissionKey(value: string): value is PermissionKey {
  return (ALL_PERMISSION_KEYS as readonly string[]).includes(value);
}
