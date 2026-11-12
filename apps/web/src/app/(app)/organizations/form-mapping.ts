export interface FormState {
  error: string | null;
  details: string[];
  saved?: boolean;
}

export const initialFormState: FormState = { error: null, details: [] };

export const PROFILE_FIELDS = [
  "legalName",
  "segment",
  "industry",
  "website",
  "phone",
  "addressLine1",
  "addressLine2",
  "city",
  "region",
  "postalCode",
  "countryCode",
  "notes",
] as const;

/**
 * Maps form fields to an API body. On create, blank optional fields are omitted; on update they
 * become null (clearing the value). Validation itself is performed by the API.
 */
export function formToOrganizationFields(
  formData: FormData,
  mode: "create" | "update",
): Record<string, string | null> {
  const out: Record<string, string | null> = {};
  const name = formData.get("name");
  if (typeof name === "string") out.name = name;
  const kind = formData.get("kind");
  if (typeof kind === "string" && kind) out.kind = kind;
  if (mode === "update") {
    const status = formData.get("status");
    if (typeof status === "string" && status) out.status = status;
  }
  for (const field of PROFILE_FIELDS) {
    const raw = formData.get(field);
    if (typeof raw !== "string") continue;
    const value = raw.trim();
    if (value === "") {
      if (mode === "update") out[field] = null;
    } else {
      out[field] = value;
    }
  }
  return out;
}
