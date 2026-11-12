import { Nav, type NavItem } from "@/components/nav";
import { SignOutButton } from "@/components/sign-out-button";
import { can, getMe } from "@/lib/me";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const me = await getMe();
  const items: NavItem[] = [{ href: "/dashboard", label: "Dashboard" }];
  if (can(me, "organization:read")) items.push({ href: "/organizations", label: "Organizations" });
  if (can(me, "project:read")) items.push({ href: "/projects", label: "Projects" });

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          EMS Platform
          <small>{me.homeOrganizationName}</small>
        </div>
        <Nav items={items} />
        <div className="sidebar-footer">
          <div>
            <div>{me.displayName}</div>
            {me.mfaSatisfied ? (
              <span className="badge ok">MFA verified</span>
            ) : (
              <span className="badge warn" title="Some actions require multi-factor authentication">
                No MFA
              </span>
            )}
          </div>
          <SignOutButton />
        </div>
      </aside>
      <main className="main">
        {!me.mfaSatisfied && me.grants.some((g) => g.mfaRequired) ? (
          <div className="alert info" role="status">
            Your roles require multi-factor authentication. Sign out and sign in again with MFA to
            use them.
          </div>
        ) : null}
        {children}
      </main>
    </div>
  );
}
