-- Integrity guards that Prisma's schema language cannot express.
-- See docs/architecture/data-model.md ("Database-enforced invariants").
--
-- Everything here is defense in depth: services validate the same rules first and return
-- friendly errors. These guards ensure no code path (including future code, scripts, or AI tools)
-- can violate the invariants.

-- ---------------------------------------------------------------------------------------------
-- Uniqueness that requires expressions or predicates
-- ---------------------------------------------------------------------------------------------

CREATE UNIQUE INDEX "users_email_lower_key" ON "users" (lower("email"));

-- Exactly one EMS operator organization.
CREATE UNIQUE INDEX "organizations_single_operator_key"
  ON "organizations" ("kind") WHERE "kind" = 'ems_operator';

CREATE INDEX "organizations_name_lower_idx" ON "organizations" (lower("name"));

-- One active role assignment per (user, role, scope).
CREATE UNIQUE INDEX "role_assignments_active_key"
  ON "role_assignments" ("user_id", "role_id", COALESCE("organization_id", '00000000-0000-0000-0000-000000000000'::uuid))
  WHERE "revoked_at" IS NULL;

-- One active membership per (project, user).
CREATE UNIQUE INDEX "project_members_active_key"
  ON "project_members" ("project_id", "user_id") WHERE "removed_at" IS NULL;

-- ---------------------------------------------------------------------------------------------
-- CHECK constraints
-- ---------------------------------------------------------------------------------------------

ALTER TABLE "organizations"
  ADD CONSTRAINT "organizations_name_len_chk" CHECK (char_length(btrim("name")) BETWEEN 2 AND 200),
  ADD CONSTRAINT "organizations_country_chk" CHECK ("country_code" IS NULL OR "country_code" ~ '^[A-Z]{2}$'),
  ADD CONSTRAINT "organizations_archived_chk" CHECK (("status" = 'archived') = ("archived_at" IS NOT NULL)),
  ADD CONSTRAINT "organizations_version_chk" CHECK ("version" >= 1);

ALTER TABLE "users"
  ADD CONSTRAINT "users_email_chk" CHECK ("email" ~ '^[^@\s]+@[^@\s]+$'),
  ADD CONSTRAINT "users_oidc_pair_chk" CHECK (("oidc_issuer" IS NULL) = ("oidc_subject" IS NULL));

ALTER TABLE "role_assignments"
  ADD CONSTRAINT "role_assignments_revocation_chk" CHECK (("revoked_at" IS NULL) OR ("revoked_at" >= "granted_at"));

ALTER TABLE "opportunities"
  ADD CONSTRAINT "opportunities_probability_chk" CHECK ("probability_pct" IS NULL OR "probability_pct" BETWEEN 0 AND 100),
  ADD CONSTRAINT "opportunities_value_chk" CHECK ("estimated_value_cents" IS NULL OR "estimated_value_cents" >= 0),
  ADD CONSTRAINT "opportunities_currency_chk" CHECK ("currency" ~ '^[A-Z]{3}$');

ALTER TABLE "proposals"
  ADD CONSTRAINT "proposals_total_chk" CHECK ("total_cents" IS NULL OR "total_cents" >= 0),
  ADD CONSTRAINT "proposals_currency_chk" CHECK ("currency" ~ '^[A-Z]{3}$');

ALTER TABLE "contracts"
  ADD CONSTRAINT "contracts_value_chk" CHECK ("value_cents" IS NULL OR "value_cents" >= 0),
  ADD CONSTRAINT "contracts_currency_chk" CHECK ("currency" ~ '^[A-Z]{3}$'),
  ADD CONSTRAINT "contracts_dates_chk" CHECK ("end_date" IS NULL OR "effective_date" IS NULL OR "end_date" >= "effective_date"),
  ADD CONSTRAINT "contracts_not_self_parent_chk" CHECK ("parent_contract_id" IS NULL OR "parent_contract_id" <> "id");

ALTER TABLE "engagements"
  ADD CONSTRAINT "engagements_dates_chk" CHECK ("end_date" IS NULL OR "start_date" IS NULL OR "end_date" >= "start_date"),
  ADD CONSTRAINT "engagements_hours_chk" CHECK ("weekly_hours_target" IS NULL OR ("weekly_hours_target" > 0 AND "weekly_hours_target" <= 80)),
  ADD CONSTRAINT "engagements_money_chk" CHECK (
    COALESCE("monthly_fee_cents", 0) >= 0 AND COALESCE("hourly_rate_cents", 0) >= 0 AND COALESCE("fixed_fee_cents", 0) >= 0),
  ADD CONSTRAINT "engagements_currency_chk" CHECK ("currency" ~ '^[A-Z]{3}$');

ALTER TABLE "projects"
  ADD CONSTRAINT "projects_dates_chk" CHECK ("target_completion_date" IS NULL OR "start_date" IS NULL OR "target_completion_date" >= "start_date");

ALTER TABLE "milestones"
  ADD CONSTRAINT "milestones_amount_chk" CHECK ("amount_cents" IS NULL OR "amount_cents" >= 0),
  ADD CONSTRAINT "milestones_billable_chk" CHECK (NOT "is_billable" OR "amount_cents" IS NOT NULL);

ALTER TABLE "tasks"
  ADD CONSTRAINT "tasks_percent_chk" CHECK ("percent_complete" BETWEEN 0 AND 100),
  ADD CONSTRAINT "tasks_planned_dates_chk" CHECK ("planned_finish" IS NULL OR "planned_start" IS NULL OR "planned_finish" >= "planned_start"),
  ADD CONSTRAINT "tasks_estimate_chk" CHECK ("estimate_hours" IS NULL OR "estimate_hours" >= 0),
  ADD CONSTRAINT "tasks_not_self_parent_chk" CHECK ("parent_task_id" IS NULL OR "parent_task_id" <> "id");

ALTER TABLE "dependencies"
  ADD CONSTRAINT "dependencies_not_self_chk" CHECK ("predecessor_task_id" <> "successor_task_id");

ALTER TABLE "risks"
  ADD CONSTRAINT "risks_probability_chk" CHECK ("probability" BETWEEN 1 AND 5),
  ADD CONSTRAINT "risks_impact_chk" CHECK ("impact" BETWEEN 1 AND 5);

ALTER TABLE "gates"
  ADD CONSTRAINT "gates_level_chk" CHECK ("required_approval_level" BETWEEN 1 AND 3),
  ADD CONSTRAINT "gates_sequence_chk" CHECK ("sequence" >= 0);

ALTER TABLE "gate_requirements"
  ADD CONSTRAINT "gate_requirements_waiver_chk" CHECK (
    NOT ("status" = 'waived' AND "is_mandatory") OR "waiver_approval_id" IS NOT NULL),
  ADD CONSTRAINT "gate_requirements_verified_chk" CHECK (
    "status" <> 'satisfied' OR ("verified_by_id" IS NOT NULL AND "verified_at" IS NOT NULL));

ALTER TABLE "change_requests"
  ADD CONSTRAINT "change_requests_currency_chk" CHECK ("currency" ~ '^[A-Z]{3}$');

ALTER TABLE "baselines"
  ADD CONSTRAINT "baselines_revision_chk" CHECK ("revision" >= 1),
  ADD CONSTRAINT "baselines_hash_chk" CHECK ("content_sha256" ~ '^[0-9a-f]{64}$'),
  ADD CONSTRAINT "baselines_approved_at_chk" CHECK ("status" NOT IN ('approved', 'superseded') OR "approved_at" IS NOT NULL);

ALTER TABLE "approvals"
  ADD CONSTRAINT "approvals_level_chk" CHECK ("level" BETWEEN 1 AND 3),
  ADD CONSTRAINT "approvals_single_target_chk" CHECK (num_nonnulls("document_revision_id", "baseline_id") = 1),
  ADD CONSTRAINT "approvals_hash_chk" CHECK ("content_sha256" ~ '^[0-9a-f]{64}$'),
  ADD CONSTRAINT "approvals_revocation_chk" CHECK (("decision" = 'revoked') = ("revokes_approval_id" IS NOT NULL)),
  ADD CONSTRAINT "approvals_mfa_chk" CHECK ("mfa_verified");

ALTER TABLE "document_revisions"
  ADD CONSTRAINT "document_revisions_number_chk" CHECK ("revision_number" >= 1),
  ADD CONSTRAINT "document_revisions_size_chk" CHECK ("size_bytes" >= 0),
  ADD CONSTRAINT "document_revisions_hash_chk" CHECK ("content_sha256" ~ '^[0-9a-f]{64}$');

ALTER TABLE "time_entries"
  ADD CONSTRAINT "time_entries_minutes_chk" CHECK ("minutes" BETWEEN 1 AND 1440),
  ADD CONSTRAINT "time_entries_approval_chk" CHECK (
    "status" NOT IN ('approved', 'invoiced') OR ("approved_by_id" IS NOT NULL AND "approved_at" IS NOT NULL)),
  ADD CONSTRAINT "time_entries_no_self_approval_chk" CHECK ("approved_by_id" IS NULL OR "approved_by_id" <> "user_id");

ALTER TABLE "invoices"
  ADD CONSTRAINT "invoices_currency_chk" CHECK ("currency" ~ '^[A-Z]{3}$'),
  ADD CONSTRAINT "invoices_amounts_chk" CHECK ("subtotal_cents" >= 0 AND "tax_cents" >= 0 AND "total_cents" = "subtotal_cents" + "tax_cents"),
  ADD CONSTRAINT "invoices_dates_chk" CHECK ("due_date" IS NULL OR "issue_date" IS NULL OR "due_date" >= "issue_date");

ALTER TABLE "invoice_lines"
  ADD CONSTRAINT "invoice_lines_quantity_chk" CHECK ("quantity" > 0);

ALTER TABLE "payments"
  ADD CONSTRAINT "payments_amount_chk" CHECK ("amount_cents" > 0),
  ADD CONSTRAINT "payments_currency_chk" CHECK ("currency" ~ '^[A-Z]{3}$'),
  -- A payment can only be verified by a human against attached evidence.
  ADD CONSTRAINT "payments_verified_chk" CHECK (
    "status" <> 'verified' OR (
      "evidence_document_revision_id" IS NOT NULL AND "verified_by_id" IS NOT NULL AND "verified_at" IS NOT NULL));

ALTER TABLE "agent_runs"
  ADD CONSTRAINT "agent_runs_usage_chk" CHECK ("input_tokens" >= 0 AND "output_tokens" >= 0 AND "cost_micros_usd" >= 0 AND "attempt" >= 1);

ALTER TABLE "agent_actions"
  ADD CONSTRAINT "agent_actions_level_chk" CHECK ("required_approval_level" BETWEEN 0 AND 3),
  -- Agents may only *execute* level-0 actions; anything higher must be proposed.
  ADD CONSTRAINT "agent_actions_execute_level_chk" CHECK ("status" <> 'executed' OR "required_approval_level" = 0),
  -- A proposed change can only be applied with a linked approval when approval is required.
  ADD CONSTRAINT "agent_actions_applied_chk" CHECK (
    "status" <> 'applied' OR "required_approval_level" = 0 OR "approval_id" IS NOT NULL);

ALTER TABLE "audit_events"
  ADD CONSTRAINT "audit_events_hash_chk" CHECK ("hash" ~ '^[0-9a-f]{64}$'),
  ADD CONSTRAINT "audit_events_prev_hash_chk" CHECK ("prev_hash" IS NULL OR "prev_hash" ~ '^[0-9a-f]{64}$'),
  ADD CONSTRAINT "audit_events_actor_chk" CHECK (
    ("actor_type" = 'user' AND "actor_user_id" IS NOT NULL) OR
    ("actor_type" = 'agent' AND "actor_agent_run_id" IS NOT NULL) OR
    ("actor_type" IN ('system', 'workflow')));

-- ---------------------------------------------------------------------------------------------
-- Append-only tables
-- ---------------------------------------------------------------------------------------------

CREATE FUNCTION ems_reject_mutation() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Table % is append-only; % is not permitted', TG_TABLE_NAME, TG_OP
    USING ERRCODE = 'integrity_constraint_violation';
END;
$$;

CREATE TRIGGER audit_events_append_only
  BEFORE UPDATE OR DELETE ON "audit_events"
  FOR EACH ROW EXECUTE FUNCTION ems_reject_mutation();
CREATE TRIGGER audit_events_no_truncate
  BEFORE TRUNCATE ON "audit_events"
  FOR EACH STATEMENT EXECUTE FUNCTION ems_reject_mutation();

CREATE TRIGGER approvals_append_only
  BEFORE UPDATE OR DELETE ON "approvals"
  FOR EACH ROW EXECUTE FUNCTION ems_reject_mutation();
CREATE TRIGGER approvals_no_truncate
  BEFORE TRUNCATE ON "approvals"
  FOR EACH STATEMENT EXECUTE FUNCTION ems_reject_mutation();

CREATE TRIGGER document_revisions_append_only
  BEFORE UPDATE OR DELETE ON "document_revisions"
  FOR EACH ROW EXECUTE FUNCTION ems_reject_mutation();

-- ---------------------------------------------------------------------------------------------
-- Approvals: server-assigned time, exact-revision binding, human approver
-- ---------------------------------------------------------------------------------------------

CREATE FUNCTION ems_approvals_before_insert() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  target_hash text;
  approver_type "UserType";
  approver_status "UserStatus";
BEGIN
  -- No backdating: decision time is always the database clock.
  NEW.decided_at := now();

  IF NEW.document_revision_id IS NOT NULL THEN
    SELECT content_sha256 INTO target_hash FROM document_revisions WHERE id = NEW.document_revision_id;
  ELSE
    SELECT content_sha256 INTO target_hash FROM baselines WHERE id = NEW.baseline_id;
  END IF;
  IF target_hash IS NULL OR target_hash <> NEW.content_sha256 THEN
    RAISE EXCEPTION 'Approval content hash does not match the target revision'
      USING ERRCODE = 'check_violation';
  END IF;

  SELECT user_type, status INTO approver_type, approver_status FROM users WHERE id = NEW.approver_user_id;
  IF approver_type IS NULL OR approver_type = 'service' OR approver_status <> 'active' THEN
    RAISE EXCEPTION 'Approvals must be made by an active human user'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER approvals_before_insert
  BEFORE INSERT ON "approvals"
  FOR EACH ROW EXECUTE FUNCTION ems_approvals_before_insert();

-- ---------------------------------------------------------------------------------------------
-- Baselines: immutable once decided
-- ---------------------------------------------------------------------------------------------

CREATE FUNCTION ems_baselines_guard() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.status <> 'draft' THEN
      RAISE EXCEPTION 'Only draft baselines can be deleted' USING ERRCODE = 'integrity_constraint_violation';
    END IF;
    RETURN OLD;
  END IF;

  IF OLD.status IN ('approved', 'superseded', 'rejected') THEN
    -- The only permitted change to a decided baseline is approved -> superseded.
    IF NOT (OLD.status = 'approved' AND NEW.status = 'superseded')
       OR NEW.snapshot IS DISTINCT FROM OLD.snapshot
       OR NEW.content_sha256 IS DISTINCT FROM OLD.content_sha256
       OR NEW.project_id IS DISTINCT FROM OLD.project_id
       OR NEW.kind IS DISTINCT FROM OLD.kind
       OR NEW.revision IS DISTINCT FROM OLD.revision
       OR NEW.approved_at IS DISTINCT FROM OLD.approved_at THEN
      RAISE EXCEPTION 'Baseline % (status %) is immutable', OLD.id, OLD.status
        USING ERRCODE = 'integrity_constraint_violation';
    END IF;
  END IF;

  IF OLD.status <> 'approved' AND NEW.status = 'approved' THEN
    IF NOT EXISTS (
      SELECT 1 FROM approvals a
       WHERE a.baseline_id = NEW.id
         AND a.decision IN ('approved', 'approved_with_conditions')
         AND a.content_sha256 = NEW.content_sha256
         AND NOT EXISTS (SELECT 1 FROM approvals r WHERE r.revokes_approval_id = a.id)
    ) THEN
      RAISE EXCEPTION 'Baseline % cannot be approved without a matching approval record', NEW.id
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER baselines_guard
  BEFORE UPDATE OR DELETE ON "baselines"
  FOR EACH ROW EXECUTE FUNCTION ems_baselines_guard();

-- ---------------------------------------------------------------------------------------------
-- Payments: verifier must be an internal human user
-- ---------------------------------------------------------------------------------------------

CREATE FUNCTION ems_payments_verifier_guard() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status = 'verified' AND NOT EXISTS (
    SELECT 1 FROM users u WHERE u.id = NEW.verified_by_id AND u.user_type = 'internal' AND u.status = 'active'
  ) THEN
    RAISE EXCEPTION 'Payments can only be verified by an active internal user'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER payments_verifier_guard
  BEFORE INSERT OR UPDATE ON "payments"
  FOR EACH ROW EXECUTE FUNCTION ems_payments_verifier_guard();
