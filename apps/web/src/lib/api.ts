import "server-only";
import { createApiClient, isProblem, type Problem } from "@ems/api-client";
import { redirect } from "next/navigation";
import { webEnv } from "./env";
import { currentSession } from "./session";

/** Typed API client bound to the signed-in user's access token (server-side only). */
export async function api() {
  const session = await currentSession();
  if (!session) redirect("/login");
  return createApiClient({
    baseUrl: webEnv().API_BASE_URL,
    getAccessToken: () => session.accessToken,
  });
}

export class ApiProblemError extends Error {
  constructor(readonly problem: Problem) {
    super(problem.detail);
  }
}

/**
 * Unwraps an openapi-fetch result. 401 sends the user to sign in again; 403 for unprovisioned or
 * inactive accounts goes to the access page; other errors throw ApiProblemError.
 */
export function unwrap<T>(result: { data?: T; error?: unknown; response: Response }): T {
  if (result.data !== undefined && result.response.ok) return result.data;
  const status = result.response.status;
  if (status === 401) redirect("/login?reason=expired");
  const problem: Problem = isProblem(result.error)
    ? result.error
    : {
        type: "about:blank",
        title: "Error",
        status,
        code: "UNKNOWN",
        detail: "The request failed.",
        instance: "",
      };
  if (problem.code === "USER_NOT_PROVISIONED" || problem.code === "USER_INACTIVE") {
    redirect(`/access?code=${encodeURIComponent(problem.code)}`);
  }
  throw new ApiProblemError(problem);
}
