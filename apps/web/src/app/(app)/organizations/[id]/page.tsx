import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArchiveButton } from "@/components/archive-button";
import { OrganizationForm } from "@/components/organization-form";
import { api, unwrap } from "@/lib/api";
import { describeAction, formatDateTime, label, statusTone } from "@/lib/format";
import { can, getMe } from "@/lib/me";
import { setArchivedAction, updateOrganizationAction } from "../actions";

export const metadata: Metadata = { title: "Organization" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function OrganizationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const me = await getMe();
  const client = await api();
  const res = await client.GET("/v1/organizations/{id}", { params: { path: { id } } });
  if (res.response.status === 404) notFound();
  const org = unwrap(res);

  const canEdit = can(me, "organization:update") && org.status !== "archived";
  const canArchive = can(me, "organization:archive") && org.kind !== "ems_operator";
  const history = can(me, "audit:read")
    ? unwrap(
        await client.GET("/v1/audit-events", {
          params: { query: { entityType: "organization", entityId: id, pageSize: 20 } },
        }),
      ).data
    : null;

  return (
    <div className="stack">
      <div className="page-header">
        <div>
          <Link href="/organizations">← Organizations</Link>
          <h1>{org.name}</h1>
          <p className="muted">
            {label(org.kind)} · <span className={`badge ${statusTone(org.status)}`}>{label(org.status)}</span>
          </p>
        </div>
        {canArchive ? (
          <ArchiveButton action={setArchivedAction} id={org.id} version={org.version} archived={org.status === "archived"} />
        ) : null}
      </div>

      {org.status === "archived" ? (
        <div className="alert info">
          This organization was archived {formatDateTime(org.archivedAt)}. Restore it to make changes.
        </div>
      ) : null}

      <OrganizationForm
        action={updateOrganizationAction}
        organization={org}
        submitLabel="Save changes"
        readOnly={!canEdit}
      />

      <section className="card">
        <h2>Record</h2>
        <dl className="details">
          <dt>Created</dt>
          <dd>{formatDateTime(org.createdAt)}</dd>
          <dt>Last updated</dt>
          <dd>{formatDateTime(org.updatedAt)}</dd>
          <dt>Version</dt>
          <dd>{org.version}</dd>
          <dt>ID</dt>
          <dd>
            <code>{org.id}</code>
          </dd>
        </dl>
      </section>

      {history ? (
        <section className="card">
          <h2>History</h2>
          {history.length === 0 ? (
            <p className="muted">No recorded changes.</p>
          ) : (
            <ul className="activity">
              {history.map((e) => (
                <li key={e.id}>
                  <strong>{describeAction(e.action)}</strong>{" "}
                  <span className="muted">
                    by {e.actorDisplayName ?? label(e.actorType)} · {formatDateTime(e.occurredAt)}
                  </span>
                  {e.action.endsWith(".updated") && e.after && typeof e.after === "object" ? (
                    <div className="muted" style={{ fontSize: "0.85rem" }}>
                      Changed: {Object.keys(e.after as object).join(", ")}
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}
    </div>
  );
}
