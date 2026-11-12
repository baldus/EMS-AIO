import type { Metadata } from "next";
import { safeReturnTo } from "@/lib/session-crypto";

export const metadata: Metadata = { title: "Sign in" };

const MESSAGES: Record<string, string> = {
  expired: "Your session expired. Please sign in again.",
  state: "The sign-in attempt expired. Please try again.",
  failed: "Sign-in could not be completed. Please try again.",
  signed_out: "You have been signed out.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string; returnTo?: string }>;
}) {
  const { reason, returnTo } = await searchParams;
  const message = reason ? MESSAGES[reason] : undefined;
  const href = `/auth/login?returnTo=${encodeURIComponent(safeReturnTo(returnTo))}`;
  return (
    <main className="center-page">
      <div className="card stack">
        <div>
          <h1>EMS Platform</h1>
          <p className="muted">Engineered &amp; Manufacturing Solutions, LTD</p>
        </div>
        {message ? <div className="alert info">{message}</div> : null}
        <a className="button" href={href}>
          Sign in with your organization account
        </a>
        <p className="muted" style={{ fontSize: "0.85rem", margin: 0 }}>
          Access is limited to provisioned users. Privileged roles require multi-factor
          authentication.
        </p>
      </div>
    </main>
  );
}
