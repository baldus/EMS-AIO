/**
 * Stable identifiers for FICTIONAL seed data. These organizations, people, and projects do not
 * exist. Email domains use the reserved `example.com` space (RFC 2606). The EMS operator
 * organization name is the platform owner's own company; it contains no customer data.
 *
 * The same user emails are provisioned in infra/keycloak/ems-realm.json for local login.
 */
export const SEED_IDS = {
  organizations: {
    ems: "6f0e2a3c-1b7d-4c55-9a51-000000000001",
    harborPoint: "6f0e2a3c-1b7d-4c55-9a51-0000000000a1",
    copperline: "6f0e2a3c-1b7d-4c55-9a51-0000000000b1",
    redMesa: "6f0e2a3c-1b7d-4c55-9a51-0000000000c1",
    brightwater: "6f0e2a3c-1b7d-4c55-9a51-0000000000d1",
  },
  users: {
    admin: "8a7d3e10-5f42-4b8e-8c0d-000000000001",
    manager: "8a7d3e10-5f42-4b8e-8c0d-000000000002",
    pm: "8a7d3e10-5f42-4b8e-8c0d-000000000003",
    finance: "8a7d3e10-5f42-4b8e-8c0d-000000000004",
    harborLead: "8a7d3e10-5f42-4b8e-8c0d-0000000000a1",
    harborEngineer: "8a7d3e10-5f42-4b8e-8c0d-0000000000a2",
    copperlineBuyer: "8a7d3e10-5f42-4b8e-8c0d-0000000000b1",
  },
  projects: {
    harborPalletizing: "3c9b6d21-0e8a-4f17-b2a4-0000000000a1",
    copperlinePress: "3c9b6d21-0e8a-4f17-b2a4-0000000000b1",
  },
  engagements: {
    harborRetainer: "51d2f8a4-7c3e-4a90-8f6b-0000000000a1",
    copperlineMilestones: "51d2f8a4-7c3e-4a90-8f6b-0000000000b1",
  },
} as const;

export const SEED_USERS = [
  {
    id: SEED_IDS.users.admin,
    email: "admin@ems.example.com",
    displayName: "Avery Admin (fictional)",
    userType: "internal",
    org: SEED_IDS.organizations.ems,
    globalRoles: ["platform_admin"],
  },
  {
    id: SEED_IDS.users.manager,
    email: "manager@ems.example.com",
    displayName: "Morgan Manager (fictional)",
    userType: "internal",
    org: SEED_IDS.organizations.ems,
    globalRoles: ["ems_manager"],
  },
  {
    id: SEED_IDS.users.pm,
    email: "pm@ems.example.com",
    displayName: "Parker PM (fictional)",
    userType: "internal",
    org: SEED_IDS.organizations.ems,
    globalRoles: ["ems_member"],
  },
  {
    id: SEED_IDS.users.finance,
    email: "finance@ems.example.com",
    displayName: "Frankie Finance (fictional)",
    userType: "internal",
    org: SEED_IDS.organizations.ems,
    globalRoles: ["ems_finance"],
  },
  {
    id: SEED_IDS.users.harborLead,
    email: "lead@harborpoint.example.com",
    displayName: "Harper Lead (fictional)",
    userType: "customer",
    org: SEED_IDS.organizations.harborPoint,
    orgRoles: ["customer_admin"],
  },
  {
    id: SEED_IDS.users.harborEngineer,
    email: "engineer@harborpoint.example.com",
    displayName: "Emery Engineer (fictional)",
    userType: "customer",
    org: SEED_IDS.organizations.harborPoint,
    orgRoles: ["customer_member"],
  },
  {
    id: SEED_IDS.users.copperlineBuyer,
    email: "buyer@copperline.example.com",
    displayName: "Casey Buyer (fictional)",
    userType: "customer",
    org: SEED_IDS.organizations.copperline,
    orgRoles: ["customer_member"],
  },
] as const;
