import { collect, type RuleResult, type RuleViolation } from "../common/result";

export const ORGANIZATION_KINDS = [
  "ems_operator",
  "customer",
  "prospect",
  "partner",
  "vendor",
] as const;
export type OrganizationKind = (typeof ORGANIZATION_KINDS)[number];

export const ORGANIZATION_STATUSES = ["active", "inactive", "archived"] as const;
export type OrganizationStatus = (typeof ORGANIZATION_STATUSES)[number];

export const ORGANIZATION_SEGMENTS = [
  "manufacturer",
  "custom_machine_builder",
  "robotics_integrator",
  "automation_company",
  "oem",
  "other",
] as const;
export type OrganizationSegment = (typeof ORGANIZATION_SEGMENTS)[number];

/** Kinds that may be set on create through the API. The operator org is seeded only. */
export const CREATABLE_ORGANIZATION_KINDS: readonly OrganizationKind[] = [
  "customer",
  "prospect",
  "partner",
  "vendor",
];

const KIND_TRANSITIONS: Readonly<Record<OrganizationKind, readonly OrganizationKind[]>> = {
  ems_operator: [],
  prospect: ["customer", "partner", "vendor"],
  customer: ["partner"],
  partner: ["customer"],
  vendor: ["partner"],
};

const STATUS_TRANSITIONS: Readonly<Record<OrganizationStatus, readonly OrganizationStatus[]>> = {
  active: ["inactive", "archived"],
  inactive: ["active", "archived"],
  archived: ["active"],
};

export type OrganizationViolationCode =
  | "INVALID_NAME"
  | "OPERATOR_IMMUTABLE"
  | "KIND_NOT_CREATABLE"
  | "KIND_TRANSITION_NOT_ALLOWED"
  | "STATUS_TRANSITION_NOT_ALLOWED"
  | "ARCHIVED_READ_ONLY";

const v = (
  code: OrganizationViolationCode,
  message: string,
): RuleViolation<OrganizationViolationCode> => ({ code, message });

/** Trims and collapses internal whitespace. */
export function normalizeOrganizationName(name: string): string {
  return name.trim().replace(/\s+/g, " ");
}

export function validateOrganizationName(
  name: string,
): RuleViolation<OrganizationViolationCode> | null {
  const n = normalizeOrganizationName(name);
  if (n.length < 2 || n.length > 200) {
    return v("INVALID_NAME", "Organization name must be 2-200 characters.");
  }
  return null;
}

export function validateOrganizationCreate(input: {
  name: string;
  kind: OrganizationKind;
}): RuleResult<OrganizationViolationCode> {
  return collect([
    validateOrganizationName(input.name),
    !CREATABLE_ORGANIZATION_KINDS.includes(input.kind) &&
      v("KIND_NOT_CREATABLE", `Organizations of kind '${input.kind}' cannot be created.`),
  ]);
}

export function validateOrganizationUpdate(input: {
  current: { kind: OrganizationKind; status: OrganizationStatus };
  next: { name?: string; kind?: OrganizationKind; status?: OrganizationStatus };
  /** True when any field other than name/kind/status is being changed (profile fields). */
  otherFieldsChanged?: boolean;
}): RuleResult<OrganizationViolationCode> {
  const { current, next } = input;
  if (current.kind === "ems_operator" && (next.kind !== undefined || next.status !== undefined)) {
    return collect([
      v("OPERATOR_IMMUTABLE", "The EMS operator organization's kind and status cannot change."),
    ]);
  }
  const isRestore = current.status === "archived" && next.status === "active";
  const hasOtherChanges =
    next.name !== undefined || next.kind !== undefined || input.otherFieldsChanged === true;
  return collect([
    current.status === "archived" &&
      !isRestore &&
      (hasOtherChanges || next.status !== undefined) &&
      v("ARCHIVED_READ_ONLY", "Archived organizations must be restored before editing."),
    current.status === "archived" &&
      isRestore &&
      hasOtherChanges &&
      v("ARCHIVED_READ_ONLY", "Restore an organization before changing other fields."),
    next.name !== undefined && validateOrganizationName(next.name),
    next.kind !== undefined &&
      next.kind !== current.kind &&
      !KIND_TRANSITIONS[current.kind].includes(next.kind) &&
      v(
        "KIND_TRANSITION_NOT_ALLOWED",
        `Organization kind cannot change from '${current.kind}' to '${next.kind}'.`,
      ),
    next.status !== undefined &&
      next.status !== current.status &&
      !STATUS_TRANSITIONS[current.status].includes(next.status) &&
      v(
        "STATUS_TRANSITION_NOT_ALLOWED",
        `Organization status cannot change from '${current.status}' to '${next.status}'.`,
      ),
  ]);
}

/** Status changes into or out of `archived` require the privileged archive permission. */
export function requiresArchivePermission(
  current: OrganizationStatus,
  next: OrganizationStatus | undefined,
): boolean {
  return next !== undefined && next !== current && (next === "archived" || current === "archived");
}
