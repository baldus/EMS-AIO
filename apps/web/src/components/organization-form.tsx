"use client";

import { useActionState } from "react";
import type { Organization } from "@ems/api-client";
import { initialFormState, type FormState } from "@/app/(app)/organizations/form-mapping";

const SEGMENTS: [string, string][] = [
  ["", "—"],
  ["manufacturer", "Manufacturer"],
  ["custom_machine_builder", "Custom machine builder"],
  ["robotics_integrator", "Robotics integrator"],
  ["automation_company", "Automation company"],
  ["oem", "OEM"],
  ["other", "Other"],
];

const KINDS: [string, string][] = [
  ["prospect", "Prospect"],
  ["customer", "Customer"],
  ["partner", "Partner"],
  ["vendor", "Vendor"],
];

interface Props {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  organization?: Organization;
  idempotencyKey?: string;
  submitLabel: string;
  readOnly?: boolean;
}

export function OrganizationForm({
  action,
  organization: o,
  idempotencyKey,
  submitLabel,
  readOnly,
}: Props) {
  const [state, formAction, pending] = useActionState(action, initialFormState);
  const isOperator = o?.kind === "ems_operator";

  return (
    <form action={formAction} className="card">
      {state.error ? (
        <div className="alert error" role="alert">
          {state.error}
          {state.details.length > 0 ? (
            <ul>
              {state.details.map((d) => (
                <li key={d}>{d}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
      {state.saved ? (
        <div className="alert info" role="status">
          Saved.
        </div>
      ) : null}

      {o ? (
        <>
          <input type="hidden" name="id" value={o.id} />
          <input type="hidden" name="version" value={o.version} />
        </>
      ) : null}
      {idempotencyKey ? <input type="hidden" name="idempotencyKey" value={idempotencyKey} /> : null}

      <fieldset disabled={readOnly || pending} style={{ border: 0, padding: 0, margin: 0 }}>
        <div className="form-grid">
          <label className="full">
            Name
            <input name="name" required minLength={2} maxLength={200} defaultValue={o?.name} />
          </label>
          {!isOperator ? (
            <label>
              Kind
              <select name="kind" defaultValue={o?.kind ?? "prospect"}>
                {KINDS.map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          {o && !isOperator && o.status !== "archived" ? (
            <label>
              Status
              <select name="status" defaultValue={o.status}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </label>
          ) : null}
          <label>
            Segment
            <select name="segment" defaultValue={o?.segment ?? ""}>
              {SEGMENTS.map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </label>
          <label>
            Legal name
            <input name="legalName" maxLength={300} defaultValue={o?.legalName ?? ""} />
          </label>
          <label>
            Industry
            <input name="industry" maxLength={120} defaultValue={o?.industry ?? ""} />
          </label>
          <label>
            Website
            <input
              name="website"
              type="url"
              maxLength={300}
              placeholder="https://"
              defaultValue={o?.website ?? ""}
            />
          </label>
          <label>
            Phone
            <input name="phone" type="tel" maxLength={50} defaultValue={o?.phone ?? ""} />
          </label>
          <label className="full">
            Address line 1
            <input name="addressLine1" maxLength={200} defaultValue={o?.addressLine1 ?? ""} />
          </label>
          <label className="full">
            Address line 2
            <input name="addressLine2" maxLength={200} defaultValue={o?.addressLine2 ?? ""} />
          </label>
          <label>
            City
            <input name="city" maxLength={120} defaultValue={o?.city ?? ""} />
          </label>
          <label>
            Region / state
            <input name="region" maxLength={120} defaultValue={o?.region ?? ""} />
          </label>
          <label>
            Postal code
            <input name="postalCode" maxLength={20} defaultValue={o?.postalCode ?? ""} />
          </label>
          <label>
            Country (ISO code)
            <input
              name="countryCode"
              maxLength={2}
              pattern="[A-Za-z]{2}"
              defaultValue={o?.countryCode ?? ""}
            />
          </label>
          <label className="full">
            Notes
            <textarea name="notes" maxLength={5000} defaultValue={o?.notes ?? ""} />
          </label>
        </div>
        {!readOnly ? (
          <div className="form-actions">
            <button type="submit">{pending ? "Saving…" : submitLabel}</button>
          </div>
        ) : null}
      </fieldset>
    </form>
  );
}
