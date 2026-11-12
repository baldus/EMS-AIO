import createClient, { type Middleware } from "openapi-fetch";
import type { components, operations, paths } from "./generated/schema";

export type { components, operations, paths };
export type Schemas = components["schemas"];
export type Organization = Schemas["OrganizationDto"];
export type OrganizationPage = Schemas["OrganizationPageDto"];
export type CreateOrganization = Schemas["CreateOrganizationDto"];
export type UpdateOrganization = Schemas["UpdateOrganizationDto"];
export type Project = Schemas["ProjectDto"];
export type ProjectMember = Schemas["ProjectMemberDto"];
export type Me = Schemas["MeDto"];
export type DashboardSummary = Schemas["DashboardSummaryDto"];
export type AuditEvent = Schemas["AuditEventDto"];
export type Problem = Schemas["ProblemDto"];

export interface ApiClientOptions {
  baseUrl: string;
  /** Returns the bearer access token for the current user, or null when unauthenticated. */
  getAccessToken: () => string | null | Promise<string | null>;
  /** Optional request id to correlate logs across services. */
  requestId?: string;
  fetch?: typeof globalThis.fetch;
}

/** Creates a typed client for the EMS API. All request/response types come from openapi.json. */
export function createApiClient(options: ApiClientOptions) {
  const client = createClient<paths>({
    baseUrl: options.baseUrl.replace(/\/$/, ""),
    ...(options.fetch ? { fetch: options.fetch } : {}),
  });
  const auth: Middleware = {
    async onRequest({ request }) {
      const token = await options.getAccessToken();
      if (token) request.headers.set("Authorization", `Bearer ${token}`);
      if (options.requestId) request.headers.set("X-Request-Id", options.requestId);
      return request;
    },
  };
  client.use(auth);
  return client;
}

export type ApiClient = ReturnType<typeof createApiClient>;

/** Narrows an unknown error body to RFC 9457 problem details. */
export function isProblem(value: unknown): value is Problem {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as Problem).status === "number" &&
    typeof (value as Problem).code === "string"
  );
}
