import type { Metadata } from "next";
import Link from "next/link";
import { api, unwrap } from "@/lib/api";
import { formatDate, label, statusTone } from "@/lib/format";

export const metadata: Metadata = { title: "Projects" };

export default async function ProjectsPage({ searchParams }: { searchParams: Promise<{ search?: string }> }) {
  const { search } = await searchParams;
  const client = await api();
  const result = unwrap(
    await client.GET("/v1/projects", {
      params: { query: { pageSize: 50, search: search?.slice(0, 100) || undefined } },
    }),
  );

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Projects</h1>
          <p className="muted">
            Customer equipment projects. EMS engagements (our paid services) are tracked separately
            and may start or end independently of the project.
          </p>
        </div>
      </div>
      <form className="filters" method="get" role="search">
        <label>
          <span className="sr-only">Search</span>
          <input type="search" name="search" placeholder="Search code or name" defaultValue={search} maxLength={100} />
        </label>
        <button type="submit" className="secondary">
          Search
        </button>
      </form>
      <div className="card table-wrap">
        {result.data.length === 0 ? (
          <p className="muted" style={{ margin: 0 }}>
            No projects found.
          </p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Code</th>
                <th className="hide-sm">Project</th>
                <th>Customer</th>
                <th>Status</th>
                <th className="hide-sm">Target completion</th>
              </tr>
            </thead>
            <tbody>
              {result.data.map((p) => (
                <tr key={p.id}>
                  <td>
                    <Link href={`/projects/${p.id}`}>{p.code}</Link>
                  </td>
                  <td className="hide-sm">{p.name}</td>
                  <td>{p.organization.name}</td>
                  <td>
                    <span className={`badge ${statusTone(p.status)}`}>{label(p.status)}</span>
                  </td>
                  <td className="hide-sm">{formatDate(p.targetCompletionDate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
