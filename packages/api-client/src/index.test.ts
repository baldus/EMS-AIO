import { describe, expect, it } from "vitest";
import { createApiClient, isProblem } from "./index";

describe("createApiClient", () => {
  it("sends the bearer token and request id, and types responses", async () => {
    const seen: Request[] = [];
    const client = createApiClient({
      baseUrl: "http://api.test/",
      getAccessToken: () => "token-123",
      requestId: "req-12345678",
      fetch: async (input) => {
        seen.push(input as Request);
        return new Response(JSON.stringify({ status: "ok" }), {
          headers: { "content-type": "application/json" },
        });
      },
    });
    const { data } = await client.GET("/health/live");
    expect(data).toEqual({ status: "ok" });
    expect(seen[0]!.url).toBe("http://api.test/health/live");
    expect(seen[0]!.headers.get("authorization")).toBe("Bearer token-123");
    expect(seen[0]!.headers.get("x-request-id")).toBe("req-12345678");
  });

  it("omits the header when there is no token", async () => {
    let auth: string | null = "unset";
    const client = createApiClient({
      baseUrl: "http://api.test",
      getAccessToken: () => null,
      fetch: async (input) => {
        auth = (input as Request).headers.get("authorization");
        return new Response("{}", { status: 401, headers: { "content-type": "application/json" } });
      },
    });
    await client.GET("/v1/me");
    expect(auth).toBeNull();
  });

  it("recognizes problem details", () => {
    expect(isProblem({ status: 404, code: "NOT_FOUND" })).toBe(true);
    expect(isProblem({ message: "nope" })).toBe(false);
  });
});
