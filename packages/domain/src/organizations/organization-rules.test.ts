import { describe, expect, it } from "vitest";
import {
  normalizeOrganizationName,
  requiresArchivePermission,
  validateOrganizationCreate,
  validateOrganizationUpdate,
} from "./organization-rules";
import { canonicalJson } from "../audit/canonical-json";

const codes = (r: { ok: boolean; errors?: readonly { code: string }[] }) =>
  r.ok ? [] : (r.errors ?? []).map((e) => e.code);

describe("organization rules", () => {
  it("normalizes names", () => {
    expect(normalizeOrganizationName("  Harbor   Point  Automation ")).toBe(
      "Harbor Point Automation",
    );
  });

  it("rejects creating a second operator org", () => {
    expect(codes(validateOrganizationCreate({ name: "Fake EMS", kind: "ems_operator" }))).toEqual([
      "KIND_NOT_CREATABLE",
    ]);
  });

  it("rejects too-short names", () => {
    expect(codes(validateOrganizationCreate({ name: " a ", kind: "prospect" }))).toEqual([
      "INVALID_NAME",
    ]);
  });

  it("allows prospect -> customer but not customer -> prospect", () => {
    const cur = { kind: "prospect" as const, status: "active" as const };
    expect(validateOrganizationUpdate({ current: cur, next: { kind: "customer" } }).ok).toBe(true);
    expect(
      codes(
        validateOrganizationUpdate({
          current: { kind: "customer", status: "active" },
          next: { kind: "prospect" },
        }),
      ),
    ).toEqual(["KIND_TRANSITION_NOT_ALLOWED"]);
  });

  it("protects the operator organization", () => {
    expect(
      codes(
        validateOrganizationUpdate({
          current: { kind: "ems_operator", status: "active" },
          next: { status: "archived" },
        }),
      ),
    ).toEqual(["OPERATOR_IMMUTABLE"]);
  });

  it("makes archived organizations read-only until restored", () => {
    const archived = { kind: "customer" as const, status: "archived" as const };
    expect(codes(validateOrganizationUpdate({ current: archived, next: { name: "New" } }))).toEqual(
      ["ARCHIVED_READ_ONLY"],
    );
    expect(
      codes(validateOrganizationUpdate({ current: archived, next: {}, otherFieldsChanged: true })),
    ).toEqual(["ARCHIVED_READ_ONLY"]);
    expect(validateOrganizationUpdate({ current: archived, next: { status: "active" } }).ok).toBe(
      true,
    );
    expect(
      codes(validateOrganizationUpdate({ current: archived, next: { status: "inactive" } })),
    ).toContain("ARCHIVED_READ_ONLY");
  });

  it("flags archive/restore as privileged", () => {
    expect(requiresArchivePermission("active", "archived")).toBe(true);
    expect(requiresArchivePermission("archived", "active")).toBe(true);
    expect(requiresArchivePermission("active", "inactive")).toBe(false);
    expect(requiresArchivePermission("active", undefined)).toBe(false);
  });
});

describe("canonicalJson", () => {
  it("sorts keys and omits undefined", () => {
    expect(canonicalJson({ b: 1, a: { d: undefined, c: [2, "x"] } })).toBe(
      '{"a":{"c":[2,"x"]},"b":1}',
    );
  });

  it("serializes dates as ISO strings and rejects NaN", () => {
    expect(canonicalJson(new Date("2026-01-02T03:04:05.000Z"))).toBe('"2026-01-02T03:04:05.000Z"');
    expect(() => canonicalJson(Number.NaN)).toThrow();
  });
});
