/** Deterministic validation result used by all domain rules. */
export type RuleResult<TCode extends string = string> =
  { ok: true } | { ok: false; errors: readonly RuleViolation<TCode>[] };

export interface RuleViolation<TCode extends string = string> {
  code: TCode;
  message: string;
}

export function collect<TCode extends string>(
  violations: readonly (RuleViolation<TCode> | null | undefined | false)[],
): RuleResult<TCode> {
  const errors = violations.filter((v): v is RuleViolation<TCode> => Boolean(v));
  return errors.length === 0 ? { ok: true } : { ok: false, errors };
}
