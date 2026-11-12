import type { Metadata } from "next";
import { SignOutButton } from "@/components/sign-out-button";

export const metadata: Metadata = { title: "Access unavailable" };

const MESSAGES: Record<string, string> = {
  USER_NOT_PROVISIONED:
    "You signed in successfully, but your account has not been provisioned on the EMS platform. Contact your EMS administrator.",
  USER_INACTIVE: "Your EMS platform account is not active. Contact your EMS administrator.",
};

export default async function AccessPage({ searchParams }: { searchParams: Promise<{ code?: string }> }) {
  const { code } = await searchParams;
  return (
    <main className="center-page">
      <div className="card stack">
        <h1>Access unavailable</h1>
        <p>{(code && MESSAGES[code]) ?? "You do not have access to this platform."}</p>
        <SignOutButton />
      </div>
    </main>
  );
}
