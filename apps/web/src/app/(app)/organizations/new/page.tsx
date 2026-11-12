import { randomUUID } from "node:crypto";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { OrganizationForm } from "@/components/organization-form";
import { can, getMe } from "@/lib/me";
import { createOrganizationAction } from "../actions";

export const metadata: Metadata = { title: "New organization" };

export default async function NewOrganizationPage() {
  const me = await getMe();
  if (!can(me, "organization:create")) notFound();
  return (
    <div>
      <div className="page-header">
        <div>
          <Link href="/organizations">← Organizations</Link>
          <h1>New organization</h1>
        </div>
      </div>
      {/* A fresh key per form render makes double-submits and retries create exactly one record. */}
      <OrganizationForm action={createOrganizationAction} idempotencyKey={`org-${randomUUID()}`} submitLabel="Create organization" />
    </div>
  );
}
