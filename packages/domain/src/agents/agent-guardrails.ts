import type { ApprovalLevel } from "../approvals/approval-rules";

/**
 * Actions no AI agent may ever perform, regardless of configuration. These are enforced in code
 * (not in prompts) at the tool-execution boundary.
 */
export const PROHIBITED_AGENT_ACTIONS = [
  "contract.sign",
  "expenditure.approve",
  "technical_release.approve",
  "safety_release.approve",
  "baseline.modify_approved",
  "invoice.mark_paid",
  "customer_acceptance.declare",
  "approval.record",
  "approval.backdate",
  "communication.send_external",
] as const;

export type ProhibitedAgentAction = (typeof PROHIBITED_AGENT_ACTIONS)[number];

export type AgentKey =
  | "lead_intelligence"
  | "sales_development"
  | "solution_architecture"
  | "proposal_contract"
  | "project_controls"
  | "risk_change"
  | "gate_compliance"
  | "finance"
  | "closeout";

/** A tool the agent is permitted to call, with the approval level its effects require. */
export interface AgentToolGrant {
  readonly action: string;
  /** 0 = may execute autonomously; >=1 = may only create a proposal for human approval. */
  readonly approvalLevel: ApprovalLevel;
}

/**
 * Static subset of the agent definition contract that governs tool execution. The full contract
 * (schemas, retry policy, evals, cost budgets) is defined in docs/architecture/agent-framework.md and
 * will be implemented in the agents module.
 */
export interface AgentExecutionPolicy {
  readonly key: AgentKey;
  readonly version: string;
  readonly tools: readonly AgentToolGrant[];
  readonly maxToolCallsPerRun: number;
}

export type AgentActionDecision =
  | { readonly mode: "execute" }
  | { readonly mode: "propose"; readonly approvalLevel: ApprovalLevel }
  | {
      readonly mode: "deny";
      readonly reason: "prohibited" | "not_granted" | "budget_exceeded";
    };

export function isProhibitedAgentAction(action: string): action is ProhibitedAgentAction {
  return (PROHIBITED_AGENT_ACTIONS as readonly string[]).includes(action);
}

/**
 * Decides whether an agent may execute an action directly, must propose it for approval, or is
 * denied. Agents only ever *execute* level-0 actions they were explicitly granted.
 */
export function decideAgentAction(
  policy: AgentExecutionPolicy,
  action: string,
  toolCallsSoFar: number,
): AgentActionDecision {
  if (isProhibitedAgentAction(action)) return { mode: "deny", reason: "prohibited" };
  if (toolCallsSoFar >= policy.maxToolCallsPerRun) {
    return { mode: "deny", reason: "budget_exceeded" };
  }
  const grant = policy.tools.find((t) => t.action === action);
  if (!grant) return { mode: "deny", reason: "not_granted" };
  if (grant.approvalLevel === 0) return { mode: "execute" };
  return { mode: "propose", approvalLevel: grant.approvalLevel };
}
