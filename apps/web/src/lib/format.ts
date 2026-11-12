const LABELS: Record<string, string> = {
  ems_operator: "EMS (operator)",
  customer: "Customer",
  prospect: "Prospect",
  partner: "Partner",
  vendor: "Vendor",
  active: "Active",
  inactive: "Inactive",
  archived: "Archived",
  proposed: "Proposed",
  on_hold: "On hold",
  completed: "Completed",
  cancelled: "Cancelled",
  planned: "Planned",
  terminated: "Terminated",
  manufacturer: "Manufacturer",
  custom_machine_builder: "Custom machine builder",
  robotics_integrator: "Robotics integrator",
  automation_company: "Automation company",
  oem: "OEM",
  other: "Other",
  fixed_price_package: "Fixed-price planning package",
  monthly_retainer: "Monthly fractional retainer",
  milestone_based: "Milestone-based execution",
  time_and_materials: "Time & materials",
  internal: "EMS",
  service: "Service",
};

/** Human label for an enum value; falls back to a title-cased version of the key. */
export function label(value: string | null | undefined): string {
  if (!value) return "—";
  return LABELS[value] ?? value.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
}

export function statusTone(status: string): "ok" | "warn" | "danger" | "" {
  if (status === "active") return "ok";
  if (status === "on_hold" || status === "inactive" || status === "proposed") return "warn";
  if (status === "archived" || status === "cancelled" || status === "terminated") return "danger";
  return "";
}

const dateTime = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "UTC",
});

/** Formats an ISO timestamp in UTC (all platform timestamps are stored in UTC). */
export function formatDateTime(iso: string | null | undefined): string {
  return iso ? `${dateTime.format(new Date(iso))} UTC` : "—";
}

export function formatDate(isoDate: string | null | undefined): string {
  if (!isoDate) return "—";
  const [y, m, d] = isoDate.slice(0, 10).split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: "UTC" }).format(
    new Date(Date.UTC(y!, m! - 1, d!)),
  );
}

/** Describes an audit action like "organization.updated" as "Organization updated". */
export function describeAction(action: string): string {
  return label(action.replace(".", " "));
}
