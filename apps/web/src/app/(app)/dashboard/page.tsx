import type { Metadata } from "next";
import Link from "next/link";
import { api, unwrap } from "@/lib/api";
import { describeAction, formatDateTime, label } from "@/lib/format";
import { can, getMe } from "@/lib/me";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const me = await getMe();
  const client = await api();
  const summary = can(me, "dashboard:view")
    ? unwrap(await client.GET("/v1/dashboard/summary"))
    : null;
  const projects = can(me, "project:read")
    ? unwrap(await client.GET("/v1/projects", { params: { query: { pageSize: 5, status: "active" } } }))
    : null;

  const totalOrgs = summary?.organizationsByKind.reduce((n, k) => n + k.count, 0) ?? 0;
  const count = (kind: string) => summary?.organizationsByKind.find((k) => k.kind === kind)?.count ?? 0;

  return (
    <div className="stack">
      <div className="page-header">
        <div>
          <h1>Welcome, {me.displayName}</h1>
          <p className="muted">Overview of the organizations and projects you can access.</p>
        </div>
      </div>

      {summary ? (
        <section className="grid stats" aria-label="Summary">
          <div className="card">
            <div className="stat-value">{totalOrgs}</div>
            <div className="stat-label">Organizations</div>
          </div>
          <div className="card">
            <div className="stat-value">{count("customer")}</div>
            <div className="stat-label">Customers</div>
          </div>
          <div className="card">
            <div className="stat-value">{count("prospect")}</div>
            <div className="stat-label">Prospects</div>
          </div>
          <div className="card">
            <div className="stat-value">{summary.activeProjects}</div>
            <div className="stat-label">Active equipment projects</div>
          </div>
          <div className="card">
            <div className="stat-value">{summary.activeEngagements}</div>
            <div className="stat-label">Active EMS engagements</div>
          </div>
        </section>
      ) : null}

      <div className="grid two">
        {projects ? (
          <section className="card">
            <h2>Active projects</h2>
            {projects.data.length === 0 ? (
              <p className="muted">No active projects.</p>
            ) : (
              <ul className="activity">
                {projects.data.map((p) => (
                  <li key={p.id}>
                    <Link href={`/projects/${p.id}`}>
                      {p.code} — {p.name}
                    </Link>
                    <div className="muted">{p.organization.name}</div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ) : null}

        {summary && summary.recentActivity.length > 0 ? (
          <section className="card">
            <h2>Recent activity</h2>
            <ul className="activity">
              {summary.recentActivity.map((a) => (
                <li key={a.id}>
                  <strong>{describeAction(a.action)}</strong>{" "}
                  <span className="muted">
                    by {a.actorDisplayName ?? label("system")} · {formatDateTime(a.occurredAt)}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </div>
  );
}
