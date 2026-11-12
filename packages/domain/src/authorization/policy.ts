import { PERMISSION_DEFINITIONS, type PermissionKey } from "./permissions";
import type { UserType } from "./roles";

/**
 * A grant is the resolved combination of a role assignment (or project membership) and the role's
 * permissions at a specific scope. Grants are loaded from the database per request.
 */
export type Grant =
  | GrantBase<{ type: "global" }>
  | GrantBase<{ type: "organization"; organizationId: string }>
  | GrantBase<{ type: "project"; projectId: string; organizationId: string }>;

interface GrantBase<TScope> {
  readonly roleKey: string;
  readonly scope: TScope;
  readonly permissions: ReadonlySet<string>;
  readonly mfaRequired: boolean;
}

export interface Principal {
  readonly userId: string;
  readonly userType: UserType;
  readonly status: "invited" | "active" | "suspended" | "deactivated";
  /** The organization the user belongs to (EMS operator org for internal users). */
  readonly homeOrganizationId: string;
  /** Whether the authenticated session satisfied multi-factor authentication. */
  readonly mfaSatisfied: boolean;
  readonly grants: readonly Grant[];
}

/**
 * The resource being accessed. `{}` (no ids) denotes a platform-level action such as creating an
 * organization, which only global grants can satisfy.
 */
export interface ResourceContext {
  readonly organizationId?: string;
  readonly projectId?: string;
}

export type DenyReason =
  "inactive_principal" | "mfa_required" | "no_matching_grant" | "unknown_permission";

export type Decision =
  | { readonly allowed: true; readonly viaRole: string }
  | { readonly allowed: false; readonly reason: DenyReason };

function grantMatchesResource(
  grant: Grant,
  permission: PermissionKey,
  resource: ResourceContext,
): boolean {
  switch (grant.scope.type) {
    case "global":
      return true;
    case "organization":
      return (
        resource.organizationId !== undefined &&
        resource.organizationId === grant.scope.organizationId
      );
    case "project": {
      if (resource.projectId !== undefined) {
        return resource.projectId === grant.scope.projectId;
      }
      const def = PERMISSION_DEFINITIONS[permission];
      return (
        def.projectGrantAppliesToParentOrganization === true &&
        resource.organizationId !== undefined &&
        resource.organizationId === grant.scope.organizationId
      );
    }
  }
}

/**
 * Tenant isolation guard independent of how roles were assigned: a customer principal's grants are
 * only ever effective inside the customer's own organization, and customers never hold global
 * grants. This protects against mis-assigned roles.
 */
function grantPermittedForPrincipal(principal: Principal, grant: Grant): boolean {
  if (principal.userType === "internal") return true;
  if (grant.scope.type === "global") return false;
  return grant.scope.organizationId === principal.homeOrganizationId;
}

/**
 * Default-deny authorization decision. Pure and deterministic.
 */
export function evaluate(
  principal: Principal,
  permission: PermissionKey,
  resource: ResourceContext,
): Decision {
  const def = PERMISSION_DEFINITIONS[permission];
  if (!def) return { allowed: false, reason: "unknown_permission" };
  if (principal.status !== "active") return { allowed: false, reason: "inactive_principal" };

  let blockedByMfa = false;
  for (const grant of principal.grants) {
    if (!grant.permissions.has(permission)) continue;
    if (!grantPermittedForPrincipal(principal, grant)) continue;
    if (!grantMatchesResource(grant, permission, resource)) continue;
    if ((def.privileged || grant.mfaRequired) && !principal.mfaSatisfied) {
      blockedByMfa = true;
      continue;
    }
    return { allowed: true, viaRole: grant.roleKey };
  }
  return { allowed: false, reason: blockedByMfa ? "mfa_required" : "no_matching_grant" };
}

/**
 * Describes the set of resources a principal may access with a permission, for building list
 * queries. `all: true` means unrestricted (global grant). Otherwise access is the union of the
 * listed organizations and projects. An empty result means no access.
 */
export interface AccessScope {
  readonly all: boolean;
  readonly organizationIds: readonly string[];
  readonly projectIds: readonly string[];
  /** Organizations reachable only because the principal is a member of one of their projects. */
  readonly organizationIdsViaProjects: readonly string[];
}

export function accessScope(principal: Principal, permission: PermissionKey): AccessScope {
  const def = PERMISSION_DEFINITIONS[permission];
  const empty: AccessScope = {
    all: false,
    organizationIds: [],
    projectIds: [],
    organizationIdsViaProjects: [],
  };
  if (!def || principal.status !== "active") return empty;

  const orgs = new Set<string>();
  const projects = new Set<string>();
  const orgsViaProjects = new Set<string>();
  for (const grant of principal.grants) {
    if (!grant.permissions.has(permission)) continue;
    if (!grantPermittedForPrincipal(principal, grant)) continue;
    if ((def.privileged || grant.mfaRequired) && !principal.mfaSatisfied) continue;
    switch (grant.scope.type) {
      case "global":
        return { ...empty, all: true };
      case "organization":
        orgs.add(grant.scope.organizationId);
        break;
      case "project":
        projects.add(grant.scope.projectId);
        if (def.projectGrantAppliesToParentOrganization) {
          orgsViaProjects.add(grant.scope.organizationId);
        }
        break;
    }
  }
  return {
    all: false,
    organizationIds: [...orgs],
    projectIds: [...projects],
    organizationIdsViaProjects: [...orgsViaProjects],
  };
}

/** Lists the permission keys effective for the principal somewhere (used by UIs for affordances). */
export function effectivePermissionKeys(principal: Principal): string[] {
  if (principal.status !== "active") return [];
  const keys = new Set<string>();
  for (const grant of principal.grants) {
    if (!grantPermittedForPrincipal(principal, grant)) continue;
    for (const key of grant.permissions) {
      const def = PERMISSION_DEFINITIONS[key as PermissionKey];
      if (!def) continue;
      if ((def.privileged || grant.mfaRequired) && !principal.mfaSatisfied) continue;
      keys.add(key);
    }
  }
  return [...keys].sort();
}
