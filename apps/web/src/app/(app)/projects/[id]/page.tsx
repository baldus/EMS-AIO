import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { api, unwrap } from "@/lib/api";
import { formatDate, formatDateTime, label, statusTone } from "@/lib/format";

export const metadata: Metadata = { title: "Project" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const client = await api();
  const res = await client.GET("/v1/projects/{id}", { params: { path: { id } } });
  if (res.response.status === 404) notFound();
  const project = unwrap(res);
  const members = unwrap(await client.GET("/v1/projects/{id}/members", { params: { path: { id } } }));

  return (
    <div className="stack">
      <div className="page-header">
        <div>
          <Link href="/projects">← Projects</Link>
          <h1>
            {project.code} — {project.name}
          </h1>
          <p className="muted">
            {project.organization.name} ·{" "}
            <span className={`badge ${statusTone(project.status)}`}>{label(project.status)}</span>
          </p>
        </div>
      </div>

      <div className="grid two">
        <section className="card">
          <h2>Equipment project</h2>
          <dl className="details">
            <dt>Equipment</dt>
            <dd>{project.equipmentType ?? "—"}</dd>
            <dt>Site</dt>
            <dd>{project.siteLocation ?? "—"}</dd>
            <dt>Start</dt>
            <dd>{formatDate(project.startDate)}</dd>
            <dt>Target completion</dt>
            <dd>{formatDate(project.targetCompletionDate)}</dd>
          </dl>
          {project.description ? <p style={{ marginTop: 12 }}>{project.description}</p> : null}
        </section>

        <section className="card">
          <h2>EMS engagements</h2>
          {project.engagements.length === 0 ? (
            <p className="muted">No EMS engagement currently covers this project.</p>
          ) : (
            <ul className="activity">
              {project.engagements.map((e) => (
                <li key={e.id}>
                  <strong>{e.name}</strong>
                  <div className="muted">
                    {label(e.commercialModel)} · {label(e.status)}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="card table-wrap">
        <h2>Project team</h2>
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Organization</th>
              <th>Project role</th>
              <th>Since</th>
            </tr>
          </thead>
          <tbody>
            {members.map((m) => (
              <tr key={`${m.userId}:${m.roleKey}`}>
                <td>{m.displayName}</td>
                <td>{label(m.userType)}</td>
                <td>{m.roleName}</td>
                <td className="muted">{formatDateTime(m.addedAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
