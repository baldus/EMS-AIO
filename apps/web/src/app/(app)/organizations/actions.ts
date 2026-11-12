"use server";

import type { CreateOrganization, UpdateOrganization } from "@ems/api-client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { api, ApiProblemError, unwrap } from "@/lib/api";
import { formToOrganizationFields, type FormState } from "./form-mapping";

function failure(err: unknown): FormState {
  if (err instanceof ApiProblemError) {
    return {
      error: err.problem.detail,
      details: err.problem.errors?.map((e) => e.message) ?? [],
    };
  }
  throw err;
}

/** Creates an organization. The idempotency key is minted when the form is rendered. */
export async function createOrganizationAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const fields = formToOrganizationFields(formData, "create");
  const idempotencyKey = String(formData.get("idempotencyKey") ?? "");
  let id: string;
  try {
    const client = await api();
    const created = unwrap(
      await client.POST("/v1/organizations", {
        body: fields as CreateOrganization,
        params: { header: { "Idempotency-Key": idempotencyKey } },
      }),
    );
    id = created.id;
  } catch (err) {
    return failure(err);
  }
  revalidatePath("/organizations");
  redirect(`/organizations/${id}`);
}

export async function updateOrganizationAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const id = String(formData.get("id") ?? "");
  const version = Number(formData.get("version"));
  const fields = formToOrganizationFields(formData, "update");
  try {
    const client = await api();
    unwrap(
      await client.PATCH("/v1/organizations/{id}", {
        params: { path: { id } },
        body: { ...fields, version } as UpdateOrganization,
      }),
    );
  } catch (err) {
    return failure(err);
  }
  revalidatePath(`/organizations/${id}`);
  return { error: null, details: [], saved: true };
}

export async function setArchivedAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const id = String(formData.get("id") ?? "");
  const version = Number(formData.get("version"));
  const archive = formData.get("intent") === "archive";
  try {
    const client = await api();
    const path = archive ? "/v1/organizations/{id}/archive" : "/v1/organizations/{id}/restore";
    unwrap(await client.POST(path, { params: { path: { id } }, body: { version } }));
  } catch (err) {
    return failure(err);
  }
  revalidatePath(`/organizations/${id}`);
  revalidatePath("/organizations");
  return { error: null, details: [], saved: true };
}
