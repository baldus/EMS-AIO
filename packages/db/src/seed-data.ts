import type { PrismaClient } from "@prisma/client";
import { syncAccessCatalog } from "./access-catalog";
import { appendAuditEvent } from "./audit";
import { SEED_IDS, SEED_USERS } from "./fixtures";

const O = SEED_IDS.organizations;
const U = SEED_IDS.users;
const PR = SEED_IDS.projects;
const E = SEED_IDS.engagements;

const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

/**
 * Seeds FICTIONAL example data for local development and demos. Idempotent: re-running updates
 * the same fixed rows. It deliberately creates NO approval records, executed contracts, invoices,
 * or payments: those must only ever come from real, authorized user actions.
 */
export async function seedDatabase(prisma: PrismaClient): Promise<void> {
  await syncAccessCatalog(prisma);

  const orgs = [
    {
      id: O.ems,
      name: "Engineered & Manufacturing Solutions, LTD",
      kind: "ems_operator" as const,
      segment: null,
      industry: "Industrial project management services",
      city: null,
      region: null,
      countryCode: null,
    },
    {
      id: O.harborPoint,
      name: "Harbor Point Automation",
      kind: "customer" as const,
      segment: "robotics_integrator" as const,
      industry: "Robotic palletizing and material handling",
      city: "Port Example",
      region: "EX",
      countryCode: "US",
    },
    {
      id: O.copperline,
      name: "Copperline Machine Works",
      kind: "customer" as const,
      segment: "custom_machine_builder" as const,
      industry: "Custom servo press and assembly machines",
      city: "Exampleton",
      region: "EX",
      countryCode: "US",
    },
    {
      id: O.redMesa,
      name: "Red Mesa Packaging Systems",
      kind: "prospect" as const,
      segment: "manufacturer" as const,
      industry: "Consumer goods packaging",
      city: "Sampleville",
      region: "EX",
      countryCode: "US",
    },
    {
      id: O.brightwater,
      name: "Brightwater Controls Supply",
      kind: "vendor" as const,
      segment: "automation_company" as const,
      industry: "Controls hardware distribution",
      city: "Demo City",
      region: "EX",
      countryCode: "US",
    },
  ];

  for (const o of orgs) {
    const data = {
      name: o.name,
      kind: o.kind,
      segment: o.segment,
      industry: o.industry,
      city: o.city,
      region: o.region,
      countryCode: o.countryCode,
      website:
        o.kind === "ems_operator"
          ? null
          : `https://${o.name.split(" ")[0]!.toLowerCase()}.example.com`,
      notes: o.kind === "ems_operator" ? null : "Fictional organization for local development.",
    };
    await prisma.organization.upsert({
      where: { id: o.id },
      create: { id: o.id, ...data },
      update: data,
    });
  }

  for (const u of SEED_USERS) {
    await prisma.user.upsert({
      where: { id: u.id },
      create: {
        id: u.id,
        email: u.email,
        displayName: u.displayName,
        userType: u.userType,
        status: "invited",
        homeOrganizationId: u.org,
      },
      update: { displayName: u.displayName, userType: u.userType, homeOrganizationId: u.org },
    });
  }

  const roles = await prisma.role.findMany({ select: { id: true, key: true } });
  const roleId = (key: string) => {
    const r = roles.find((x) => x.key === key);
    if (!r) throw new Error(`Role ${key} not found`);
    return r.id;
  };

  const assign = async (userId: string, key: string, organizationId: string | null) => {
    const existing = await prisma.roleAssignment.findFirst({
      where: { userId, roleId: roleId(key), organizationId, revokedAt: null },
    });
    if (!existing) {
      await prisma.roleAssignment.create({
        data: { userId, roleId: roleId(key), organizationId, grantedById: null },
      });
    }
  };
  for (const u of SEED_USERS) {
    for (const key of "globalRoles" in u ? u.globalRoles : []) await assign(u.id, key, null);
    for (const key of "orgRoles" in u ? u.orgRoles : []) await assign(u.id, key, u.org);
  }

  const projects = [
    {
      id: PR.harborPalletizing,
      organizationId: O.harborPoint,
      code: "HPA-2026-001",
      name: "Palletizing Cell Retrofit — Line 3",
      description:
        "Fictional: retrofit of a two-robot palletizing cell with new safety scanners and HMI.",
      status: "active" as const,
      equipmentType: "Robotic palletizing cell",
      siteLocation: "Port Example plant (fictional)",
      startDate: d("2026-09-01"),
      targetCompletionDate: d("2027-03-31"),
    },
    {
      id: PR.copperlinePress,
      organizationId: O.copperline,
      code: "CMW-2026-001",
      name: "Servo Press Line Commissioning",
      description: "Fictional: build, FAT, ship and commission a 3-station servo press line.",
      status: "active" as const,
      equipmentType: "Servo press line",
      siteLocation: "End-customer site (fictional)",
      startDate: d("2026-10-15"),
      targetCompletionDate: d("2027-06-30"),
    },
  ];
  for (const p of projects) {
    const { id, ...data } = p;
    await prisma.project.upsert({ where: { id }, create: p, update: data });
  }

  const engagements = [
    {
      id: E.harborRetainer,
      organizationId: O.harborPoint,
      name: "Fractional PM retainer (15 h/week)",
      commercialModel: "monthly_retainer" as const,
      status: "active" as const,
      startDate: d("2026-09-01"),
      endDate: d("2027-02-28"),
      weeklyHoursTarget: "15.00",
      monthlyFeeCents: 1_200_000n,
      engagementManagerId: U.manager,
      projectId: PR.harborPalletizing,
    },
    {
      id: E.copperlineMilestones,
      organizationId: O.copperline,
      name: "Milestone-based execution support",
      commercialModel: "milestone_based" as const,
      status: "active" as const,
      startDate: d("2026-10-15"),
      endDate: d("2027-07-31"),
      weeklyHoursTarget: "12.00",
      monthlyFeeCents: null,
      engagementManagerId: U.manager,
      projectId: PR.copperlinePress,
    },
  ];
  for (const { projectId, ...e } of engagements) {
    const { id, ...data } = e;
    await prisma.engagement.upsert({ where: { id }, create: e, update: data });
    await prisma.engagementProject.upsert({
      where: { engagementId_projectId: { engagementId: id, projectId } },
      create: { engagementId: id, projectId },
      update: {},
    });
  }

  const members: [string, string, string][] = [
    [PR.harborPalletizing, U.pm, "project_manager"],
    [PR.copperlinePress, U.pm, "project_manager"],
    [PR.harborPalletizing, U.harborEngineer, "customer_technical_approver"],
    [PR.copperlinePress, U.copperlineBuyer, "customer_commercial_approver"],
  ];
  for (const [projectId, userId, key] of members) {
    const existing = await prisma.projectMember.findFirst({
      where: { projectId, userId, removedAt: null },
    });
    if (!existing) {
      await prisma.projectMember.create({ data: { projectId, userId, roleId: roleId(key) } });
    }
  }

  // Stage gates for the Harbor Point project (status only; no approvals are fabricated).
  const gates = [
    {
      code: "G0",
      name: "Project Charter & Kickoff",
      sequence: 0,
      level: 2,
      status: "ready_for_review" as const,
    },
    { code: "G1", name: "Design Review", sequence: 1, level: 3, status: "in_preparation" as const },
    {
      code: "G2",
      name: "Factory Acceptance Test (FAT)",
      sequence: 2,
      level: 3,
      status: "not_started" as const,
    },
    {
      code: "G3",
      name: "Site Acceptance Test (SAT)",
      sequence: 3,
      level: 3,
      status: "not_started" as const,
    },
    {
      code: "G4",
      name: "Handover & Closeout",
      sequence: 4,
      level: 2,
      status: "not_started" as const,
    },
  ];
  for (const g of gates) {
    await prisma.gate.upsert({
      where: { projectId_code: { projectId: PR.harborPalletizing, code: g.code } },
      create: {
        projectId: PR.harborPalletizing,
        code: g.code,
        name: g.name,
        sequence: g.sequence,
        requiredApprovalLevel: g.level,
        status: g.status,
      },
      update: { name: g.name, requiredApprovalLevel: g.level },
    });
  }

  const contactSeeds = [
    {
      organizationId: O.harborPoint,
      firstName: "Harper",
      lastName: "Lead",
      email: "lead@harborpoint.example.com",
      jobTitle: "Engineering Manager",
      isPrimary: true,
    },
    {
      organizationId: O.copperline,
      firstName: "Casey",
      lastName: "Buyer",
      email: "buyer@copperline.example.com",
      jobTitle: "Purchasing Lead",
      isPrimary: true,
    },
    {
      organizationId: O.redMesa,
      firstName: "Riley",
      lastName: "Prospect",
      email: "riley@redmesa.example.com",
      jobTitle: "Plant Manager",
      isPrimary: true,
    },
  ];
  for (const c of contactSeeds) {
    const existing = await prisma.contact.findFirst({
      where: { organizationId: c.organizationId, email: c.email },
    });
    if (!existing) await prisma.contact.create({ data: c });
  }

  const existingOpp = await prisma.opportunity.findFirst({ where: { organizationId: O.redMesa } });
  if (!existingOpp) {
    await prisma.opportunity.create({
      data: {
        organizationId: O.redMesa,
        name: "Case packer line — project planning package",
        stage: "qualified",
        commercialModel: "fixed_price_package",
        estimatedValueCents: 1_850_000n,
        probabilityPct: 40,
        expectedCloseDate: d("2027-01-15"),
        ownerUserId: U.manager,
        source: "Referral (fictional)",
      },
    });
  }

  await prisma.$transaction(async (tx) => {
    await appendAuditEvent(tx, {
      actorType: "system",
      action: "seed.applied",
      entityType: "system",
      metadata: { note: "Fictional development seed data applied" },
    });
  });
}
