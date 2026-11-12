import "server-only";
import { cache } from "react";
import type { Me } from "@ems/api-client";
import { api, unwrap } from "./api";

/** The signed-in user's identity and effective permissions, fetched once per request. */
export const getMe = cache(async (): Promise<Me> => {
  const client = await api();
  return unwrap(await client.GET("/v1/me"));
});

export function can(me: Me, permission: string): boolean {
  return me.permissions.includes(permission);
}
