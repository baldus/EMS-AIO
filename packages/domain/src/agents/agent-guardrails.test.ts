import { describe, expect, it } from "vitest";
import {
  PROHIBITED_AGENT_ACTIONS,
  decideAgentAction,
  type AgentExecutionPolicy,
} from "./agent-guardrails";

const policy: AgentExecutionPolicy = {
  key: "finance",
  version: "0.1.0",
  maxToolCallsPerRun: 5,
  tools: [
    { action: "invoice.draft", approvalLevel: 0 },
    { action: "invoice.release", approvalLevel: 1 },
    // A misconfiguration that grants a prohibited action must still be denied.
    { action: "invoice.mark_paid", approvalLevel: 0 },
  ],
};

describe("decideAgentAction", () => {
  it("executes granted level-0 actions", () => {
    expect(decideAgentAction(policy, "invoice.draft", 0)).toEqual({ mode: "execute" });
  });

  it("only proposes actions requiring approval", () => {
    expect(decideAgentAction(policy, "invoice.release", 0)).toEqual({
      mode: "propose",
      approvalLevel: 1,
    });
  });

  it("denies prohibited actions even if granted", () => {
    expect(decideAgentAction(policy, "invoice.mark_paid", 0)).toEqual({
      mode: "deny",
      reason: "prohibited",
    });
  });

  it.each(PROHIBITED_AGENT_ACTIONS)("always denies %s", (action) => {
    const permissive: AgentExecutionPolicy = {
      ...policy,
      tools: [{ action, approvalLevel: 0 }],
    };
    expect(decideAgentAction(permissive, action, 0).mode).toBe("deny");
  });

  it("denies actions not granted", () => {
    expect(decideAgentAction(policy, "contract.draft", 0)).toEqual({
      mode: "deny",
      reason: "not_granted",
    });
  });

  it("enforces the per-run tool budget", () => {
    expect(decideAgentAction(policy, "invoice.draft", 5)).toEqual({
      mode: "deny",
      reason: "budget_exceeded",
    });
  });
});
