import { PERMISSIONS as P, type PermissionKey, type ScopeType } from "./permissions";

export type UserType = "internal" | "customer" | "service";

export interface SystemRoleDefinition {
  readonly key: string;
  readonly name: string;
  readonly description: string;
  /** The scope at which this role is assigned. */
  readonly scope: ScopeType;
  /** Which user types may hold this role. */
  readonly assignableTo: readonly UserType[];
  /** Holders must have completed MFA for any grant of this role to be effective. */
  readonly mfaRequired: boolean;
  readonly permissions: readonly PermissionKey[];
}

const role = (r: SystemRoleDefinition) => r;

/**
 * System roles seeded into the `roles` table. Custom roles may be added later; system roles are
 * immutable through the API (`is_system = true`).
 */
export const SYSTEM_ROLES = {
  PLATFORM_ADMIN: role({
    key: "platform_admin",
    name: "Platform Administrator",
    description: "EMS administrator. Manages users, roles, and platform configuration.",
    scope: "global",
    assignableTo: ["internal"],
    mfaRequired: true,
    permissions: [
      P.DASHBOARD_VIEW,
      P.ORGANIZATION_READ,
      P.ORGANIZATION_CREATE,
      P.ORGANIZATION_UPDATE,
      P.ORGANIZATION_ARCHIVE,
      P.CONTACT_READ,
      P.CONTACT_WRITE,
      P.PROJECT_READ,
      P.AUDIT_READ,
      P.USER_READ,
      P.USER_MANAGE,
      P.ROLE_MANAGE,
    ],
  }),
  EMS_MANAGER: role({
    key: "ems_manager",
    name: "EMS Manager",
    description: "EMS leadership. Manages CRM, sales, delivery oversight; Level 1 approvals.",
    scope: "global",
    assignableTo: ["internal"],
    mfaRequired: true,
    permissions: [
      P.DASHBOARD_VIEW,
      P.ORGANIZATION_READ,
      P.ORGANIZATION_CREATE,
      P.ORGANIZATION_UPDATE,
      P.ORGANIZATION_ARCHIVE,
      P.CONTACT_READ,
      P.CONTACT_WRITE,
      P.OPPORTUNITY_READ,
      P.OPPORTUNITY_WRITE,
      P.PROJECT_READ,
      P.PROJECT_CREATE,
      P.PROJECT_UPDATE,
      P.PROJECT_MEMBER_MANAGE,
      P.APPROVAL_EMS_INTERNAL,
      P.FINANCE_READ,
      P.AGENT_RUN,
      P.AGENT_REVIEW,
      P.AUDIT_READ,
      P.USER_READ,
    ],
  }),
  EMS_FINANCE: role({
    key: "ems_finance",
    name: "EMS Finance",
    description: "Invoicing, payment recording and verification.",
    scope: "global",
    assignableTo: ["internal"],
    mfaRequired: true,
    permissions: [
      P.DASHBOARD_VIEW,
      P.ORGANIZATION_READ,
      P.FINANCE_READ,
      P.FINANCE_MANAGE,
      P.PAYMENT_VERIFY,
    ],
  }),
  EMS_MEMBER: role({
    key: "ems_member",
    name: "EMS Team Member",
    description: "EMS staff. CRM visibility; project access only through project membership.",
    scope: "global",
    assignableTo: ["internal"],
    mfaRequired: false,
    permissions: [
      P.DASHBOARD_VIEW,
      P.ORGANIZATION_READ,
      P.CONTACT_READ,
      P.OPPORTUNITY_READ,
      P.AGENT_RUN,
    ],
  }),
  CUSTOMER_ADMIN: role({
    key: "customer_admin",
    name: "Customer Administrator",
    description: "Customer-side lead. Sees all of their organization's EMS projects.",
    scope: "organization",
    assignableTo: ["customer"],
    mfaRequired: true,
    permissions: [
      P.DASHBOARD_VIEW,
      P.ORGANIZATION_READ,
      P.CONTACT_READ,
      P.PROJECT_READ,
      P.FINANCE_READ,
      P.USER_READ,
    ],
  }),
  CUSTOMER_MEMBER: role({
    key: "customer_member",
    name: "Customer Member",
    description: "Customer user. Project access only through project membership.",
    scope: "organization",
    assignableTo: ["customer"],
    mfaRequired: false,
    permissions: [P.DASHBOARD_VIEW, P.ORGANIZATION_READ],
  }),
  PROJECT_MANAGER: role({
    key: "project_manager",
    name: "Project Manager",
    description: "EMS fractional PM on a project. Maintains plan, risks, changes (not baselines).",
    scope: "project",
    assignableTo: ["internal"],
    mfaRequired: false,
    permissions: [
      P.DASHBOARD_VIEW,
      P.ORGANIZATION_READ,
      P.PROJECT_READ,
      P.PROJECT_UPDATE,
      P.PROJECT_MEMBER_MANAGE,
      P.AGENT_RUN,
    ],
  }),
  PROJECT_CONTRIBUTOR: role({
    key: "project_contributor",
    name: "Project Contributor",
    description: "Works on tasks, logs time, raises risks and issues.",
    scope: "project",
    assignableTo: ["internal", "customer"],
    mfaRequired: false,
    permissions: [P.DASHBOARD_VIEW, P.ORGANIZATION_READ, P.PROJECT_READ, P.PROJECT_UPDATE],
  }),
  PROJECT_VIEWER: role({
    key: "project_viewer",
    name: "Project Viewer",
    description: "Read-only project access.",
    scope: "project",
    assignableTo: ["internal", "customer"],
    mfaRequired: false,
    permissions: [P.DASHBOARD_VIEW, P.ORGANIZATION_READ, P.PROJECT_READ],
  }),
  CUSTOMER_COMMERCIAL_APPROVER: role({
    key: "customer_commercial_approver",
    name: "Customer Commercial Approver",
    description: "Customer authority for Level 2 commercial approvals on a project.",
    scope: "project",
    assignableTo: ["customer"],
    mfaRequired: true,
    permissions: [
      P.DASHBOARD_VIEW,
      P.ORGANIZATION_READ,
      P.PROJECT_READ,
      P.APPROVAL_CUSTOMER_COMMERCIAL,
    ],
  }),
  CUSTOMER_TECHNICAL_APPROVER: role({
    key: "customer_technical_approver",
    name: "Customer Technical/Safety Approver",
    description: "Customer authority for Level 3 technical and safety releases on a project.",
    scope: "project",
    assignableTo: ["customer"],
    mfaRequired: true,
    permissions: [
      P.DASHBOARD_VIEW,
      P.ORGANIZATION_READ,
      P.PROJECT_READ,
      P.APPROVAL_CUSTOMER_TECHNICAL,
    ],
  }),
} as const;

export type SystemRoleKey = (typeof SYSTEM_ROLES)[keyof typeof SYSTEM_ROLES]["key"];

export const SYSTEM_ROLE_LIST: readonly SystemRoleDefinition[] = Object.values(SYSTEM_ROLES);
