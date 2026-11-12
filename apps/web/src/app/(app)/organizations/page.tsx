import type { Metadata } from "next";
import Link from "next/link";
import { ORGANIZATION_KINDS, ORGANIZATION_STATUSES } from "@ems/domain";
import { api, unwrap } from "@/lib/api";
import { formatDateTime, label, statusTone } from "@/lib/format";
import { can, getMe } from "@/lib/me";

export const metadata: Metadata = { title: "Organizations" };

type Search = { search?: string; kind?: string; status?: string; page?: string };

const oneOf = <T extends string>(values: readonly T[], v: string | undefined): T | undefined =>
  values.includes(v as T) ? (v as T) : undefined;

export default async function OrganizationsPage({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams;
  const me = await getMe();
  const page = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);
  const kind = oneOf(ORGANIZATION_KINDS, sp.kind);
  const status = oneOf(ORGANIZATION_STATUSES, sp.status);
  const search = sp.search?.slice(0, 100) || undefined;

  const client = await api();
  const result = unwrap(
    await client.GET("/v1/organizations", {
      params: { query: { page, pageSize: 25, search, kind, status, includeArchived: status === "archived" } },
    }),
  );
  const totalPages = Math.max(1, Math.ceil(result.meta.total / result.meta.pageSize));
  const pageHref = (p: number) => {
    const q = new URLSearchParams();
    if (search) q.set("search", search);
    if (kind) q.set("kind", kind);
    if (status) q.set("status", status);
    q.set("page", String(p));
    return `/organizations?${q.toString()}`;
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Organizations</h1>
          <p className="muted">Customers, prospects, partners, and vendors.</p>
        </div>
        {can(me, "organization:create") ? (
          <Link className="button" href="/organizations/new">
            New organization
          </Link>
        ) : null}
      </div>

      <form className="filters" method="get" role="search">
        <label>
          <span className="sr-only">Search</span>
          <input type="search" name="search" placeholder="Search by name" defaultValue={search} maxLength={100} />
        </label>
        <label>
          <span className="sr-only">Kind</span>
          <select name="kind" defaultValue={kind ?? ""}>
            <option value="">All kinds</option>
            {ORGANIZATION_KINDS.map((k) => (
              <option key={k} value={k}>
                {label(k)}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="sr-only">Status</span>
          <select name="status" defaultValue={status ?? ""}>
            <option value="">Active &amp; inactive</option>
            {ORGANIZATION_STATUSES.map((s) => (
              <option key={s} value={s}>
                {label(s)}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className="secondary">
          Apply
        </button>
      </form>

      <div className="card table-wrap">
        {result.data.length === 0 ? (
          <p className="muted" style={{ margin: 0 }}>
            No organizations match these filters.
          </p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Kind</th>
                <th className="hide-sm">Segment</th>
                <th>Status</th>
                <th className="hide-sm">Updated</th>
              </tr>
            </thead>
            <tbody>
              {result.data.map((o) => (
                <tr key={o.id}>
                  <td>
                    <Link href={`/organizations/${o.id}`}>{o.name}</Link>
                  </td>
                  <td>{label(o.kind)}</td>
                  <td className="hide-sm">{label(o.segment)}</td>
                  <td>
                    <span className={`badge ${statusTone(o.status)}`}>{label(o.status)}</span>
                  </td>
                  <td className="muted hide-sm">{formatDateTime(o.updatedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <nav className="pager" aria-label="Pagination">
        {page > 1 ? <Link href={pageHref(page - 1)}>← Previous</Link> : null}
        <span className="muted">
          Page {page} of {totalPages} · {result.meta.total} total
        </span>
        {page < totalPages ? <Link href={pageHref(page + 1)}>Next →</Link> : null}
      </nav>
    </div>
  );
}
