/**
 * Deterministic JSON serialization (sorted object keys, no insignificant whitespace) used to
 * compute tamper-evident hashes of audit events. Dates serialize as ISO-8601 UTC strings;
 * `undefined` object members are omitted; bigint serializes as a decimal string.
 */
export function canonicalJson(value: unknown): string {
  return serialize(value);
}

function serialize(value: unknown): string {
  if (value === null || value === undefined) return "null";
  if (value instanceof Date) return JSON.stringify(value.toISOString());
  switch (typeof value) {
    case "string":
    case "boolean":
      return JSON.stringify(value);
    case "number":
      if (!Number.isFinite(value)) throw new TypeError("Cannot canonicalize non-finite number");
      return JSON.stringify(value);
    case "bigint":
      return JSON.stringify(value.toString());
    case "object": {
      if (Array.isArray(value)) return `[${value.map(serialize).join(",")}]`;
      const obj = value as Record<string, unknown>;
      const keys = Object.keys(obj)
        .filter((k) => obj[k] !== undefined)
        .sort();
      return `{${keys.map((k) => `${JSON.stringify(k)}:${serialize(obj[k])}`).join(",")}}`;
    }
    default:
      throw new TypeError(`Cannot canonicalize value of type ${typeof value}`);
  }
}
