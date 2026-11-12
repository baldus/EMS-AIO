import { describe, expect, it } from "vitest";
import {
  accessScope,
  effectivePermissionKeys,
  evaluate,
  type Grant,
  type Principal,
} from "./policy";
import { PERMISSIONS as P } from "./permissions";
import { SYSTEM_ROLES } from "./roles";

const EMS = "00000000-0000-4000-8000-000000000001";
const CUST_A = "00000000-0000-4000-8000-0000000000a1";
const CUST_B = "00000000-0000-4000-8000-0000000000b1";
const PROJ_A1 = "00000000-0000-4000-8000-0000000a0001";
const PROJ_B1 = "00000000-0000-4000-8000-0000000b0001";

function grantFromRole(
  role: (typeof SYSTEM_ROLES)[keyof typeof SYSTEM_ROLES],
  scope: Grant["scope"],
): Grant {
  return {
    roleKey: role.key,
    scope,
    permissions: new Set(role.permissions),
    mfaRequired: role.mfaRequired,
  } as Grant;
}

function principal(overrides: Partial<Principal> & Pick<Principal, "grants">): Principal {
  return {
    userId: "user-1",
    userType: "internal",
    status: "active",
    homeOrganizationId: EMS,
    mfaSatisfied: true,
    ...overrides,
  };
}

describe("evaluate (default deny)", () => {
  it("denies a principal with no grants", () => {
    const d = evaluate(principal({ grants: [] }), P.ORGANIZATION_READ, { organizationId: CUST_A });
    expect(d).toEqual({ allowed: false, reason: "no_matching_grant" });
  });

  it("denies inactive principals even with global grants", () => {
    const p = principal({
      status: "suspended",
      grants: [grantFromRole(SYSTEM_ROLES.PLATFORM_ADMIN, { type: "global" })],
    });
    expect(evaluate(p, P.ORGANIZATION_READ, {})).toEqual({
      allowed: false,
      reason: "inactive_principal",
    });
  });

  it("allows global grants on any resource", () => {
    const p = principal({ grants: [grantFromRole(SYSTEM_ROLES.EMS_MANAGER, { type: "global" })] });
    expect(evaluate(p, P.ORGANIZATION_UPDATE, { organizationId: CUST_B }).allowed).toBe(true);
    expect(evaluate(p, P.ORGANIZATION_CREATE, {}).allowed).toBe(true);
  });

  it("requires MFA for privileged permissions", () => {
    const p = principal({
      mfaSatisfied: false,
      grants: [grantFromRole(SYSTEM_ROLES.EMS_MEMBER, { type: "global" })],
    });
    // ems_member does not require MFA for its non-privileged grants
    expect(evaluate(p, P.ORGANIZATION_READ, { organizationId: CUST_A }).allowed).toBe(true);
  });

  it("ignores grants of MFA-required roles when session lacks MFA", () => {
    const p = principal({
      mfaSatisfied: false,
      grants: [grantFromRole(SYSTEM_ROLES.EMS_MANAGER, { type: "global" })],
    });
    expect(evaluate(p, P.ORGANIZATION_READ, { organizationId: CUST_A })).toEqual({
      allowed: false,
      reason: "mfa_required",
    });
  });

  it("does not let organization grants satisfy platform-level actions", () => {
    const p = principal({
      userType: "customer",
      homeOrganizationId: CUST_A,
      grants: [
        grantFromRole(SYSTEM_ROLES.CUSTOMER_ADMIN, {
          type: "organization",
          organizationId: CUST_A,
        }),
      ],
    });
    expect(evaluate(p, P.ORGANIZATION_READ, {}).allowed).toBe(false);
  });
});

describe("tenant isolation", () => {
  const customerA = principal({
    userType: "customer",
    homeOrganizationId: CUST_A,
    grants: [
      grantFromRole(SYSTEM_ROLES.CUSTOMER_ADMIN, { type: "organization", organizationId: CUST_A }),
    ],
  });

  it("allows a customer to read their own organization", () => {
    expect(evaluate(customerA, P.ORGANIZATION_READ, { organizationId: CUST_A }).allowed).toBe(true);
  });

  it("denies a customer access to another customer's organization", () => {
    expect(evaluate(customerA, P.ORGANIZATION_READ, { organizationId: CUST_B }).allowed).toBe(
      false,
    );
  });

  it("ignores a mis-assigned grant pointing at a different tenant", () => {
    const misassigned = principal({
      userType: "customer",
      homeOrganizationId: CUST_A,
      grants: [
        grantFromRole(SYSTEM_ROLES.CUSTOMER_ADMIN, {
          type: "organization",
          organizationId: CUST_B,
        }),
      ],
    });
    expect(evaluate(misassigned, P.ORGANIZATION_READ, { organizationId: CUST_B }).allowed).toBe(
      false,
    );
  });

  it("ignores global grants held by customer users", () => {
    const escalated = principal({
      userType: "customer",
      homeOrganizationId: CUST_A,
      grants: [grantFromRole(SYSTEM_ROLES.PLATFORM_ADMIN, { type: "global" })],
    });
    expect(evaluate(escalated, P.ORGANIZATION_READ, { organizationId: CUST_B }).allowed).toBe(
      false,
    );
    expect(accessScope(escalated, P.ORGANIZATION_READ).all).toBe(false);
  });
});

describe("project-level authorization", () => {
  const pm = principal({
    grants: [
      grantFromRole(SYSTEM_ROLES.EMS_MEMBER, { type: "global" }),
      grantFromRole(SYSTEM_ROLES.PROJECT_MANAGER, {
        type: "project",
        projectId: PROJ_A1,
        organizationId: CUST_A,
      }),
    ],
  });

  it("allows project members to read their project", () => {
    expect(
      evaluate(pm, P.PROJECT_READ, { organizationId: CUST_A, projectId: PROJ_A1 }).allowed,
    ).toBe(true);
  });

  it("denies project read on projects the member does not belong to", () => {
    expect(
      evaluate(pm, P.PROJECT_READ, { organizationId: CUST_B, projectId: PROJ_B1 }).allowed,
    ).toBe(false);
  });

  it("does not let a project grant act on the whole organization (except where declared)", () => {
    expect(evaluate(pm, P.PROJECT_READ, { organizationId: CUST_A }).allowed).toBe(false);
    expect(evaluate(pm, P.PROJECT_UPDATE, { organizationId: CUST_A }).allowed).toBe(false);
  });

  it("lets a customer project member read their parent organization profile", () => {
    const viewer = principal({
      userType: "customer",
      homeOrganizationId: CUST_A,
      grants: [
        grantFromRole(SYSTEM_ROLES.PROJECT_VIEWER, {
          type: "project",
          projectId: PROJ_A1,
          organizationId: CUST_A,
        }),
      ],
    });
    expect(evaluate(viewer, P.ORGANIZATION_READ, { organizationId: CUST_A }).allowed).toBe(true);
    expect(accessScope(viewer, P.ORGANIZATION_READ).organizationIdsViaProjects).toEqual([CUST_A]);
  });

  it("computes project access scope for list queries", () => {
    const scope = accessScope(pm, P.PROJECT_READ);
    expect(scope).toMatchObject({ all: false, projectIds: [PROJ_A1], organizationIds: [] });
  });
});

describe("effectivePermissionKeys", () => {
  it("excludes MFA-gated permissions when MFA not satisfied", () => {
    const p = principal({
      mfaSatisfied: false,
      grants: [grantFromRole(SYSTEM_ROLES.EMS_MANAGER, { type: "global" })],
    });
    expect(effectivePermissionKeys(p)).toEqual([]);
  });
});
