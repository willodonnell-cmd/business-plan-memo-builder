import { getD1 } from "../db";
import {
  DEFAULT_PLAN_ID,
  type ActivityEvent,
  type Approver,
  type BusinessPlanWorkstream,
  type CollaborativeGroup,
  type EnablementFunction,
  type InvestmentRequest,
  type InvestmentRequestExport,
  type InvestmentRequestLine,
  type InvestmentRequestStatus,
  type InvestmentRequestType,
  type IssueType,
  type Question,
  type QuestionStatus,
  type Role,
  type SectionStatus,
  type Visibility,
  type WorkspaceUser,
  type WorkspacePlan,
  approverDefaults,
  businessPlanWorkstreams,
  emptyInvestmentRequestLine,
  investmentWorkbookProfiles,
  sectionDefaults,
} from "./workspace-defaults";
import { cleanDisplayName, displayNameFromEmail, normalizeEmail, resolveActorIdentityFromRequest } from "./request-identity";

type BusinessPlanRow = {
  id: string;
  title: string;
  team_name: string;
  approval_state: SectionStatus;
  approval_posture: string;
};

type SectionRow = {
  id: string;
  section_key: string;
  title: string;
  position: number;
  content: string;
  status: SectionStatus;
};

type QuestionRow = {
  id: string;
  section_id: string;
  author_name: string;
  author_role: Role;
  visibility: Visibility;
  status: QuestionStatus;
  issue_type: IssueType | null;
  function_name: EnablementFunction | null;
  body: string;
  response: string | null;
};

type ApproverRow = {
  id: string;
  name: string;
  title: string;
  posture: string;
};

type ActivityRow = {
  id: string;
  actor_email: string;
  actor_role: Role;
  object_type: string;
  object_id: string;
  action: string;
  old_value: string | null;
  new_value: string | null;
  created_at: number;
};

type GroupRow = {
  id: string;
  group_type: "Enablement" | "Advisor";
  name: string;
  description: string;
};

type InvestmentRequestRow = {
  id: string;
  plan_id: string;
  request_type: InvestmentRequestType;
  status: InvestmentRequestStatus;
  owner_name: string;
  owner_email: string;
  initiative: string;
  strategic_objective: string;
  milestone: string;
  alternatives: string;
  measurable_outcome: string;
  not_approved_impact: string;
  created_at: number;
  updated_at: number;
  submitted_at: number | null;
};

type InvestmentRequestLineRow = {
  id: string;
  request_id: string;
  line_type: InvestmentRequestType;
  position: number;
  line_data: string;
};

export type Actor = WorkspaceUser;

const allowedSectionStatuses = ["Draft", "Review", "Approval", "Approved"] as const;
const allowedQuestionStatuses = ["Open", "Answered", "Resolved", "Reopened", "No Change Needed"] as const;
const allowedIssueTypes = [
  "Clarification",
  "Functional Dependency",
  "Support Need",
  "Risk / Constraint",
  "Required Input",
  "Approval Concern",
] as const;
const allowedEnablementFunctions = ["", "HR", "Legal", "IT", "Finance & Accounting", "Tax", "Marketing", "CLS", "Other"] as const;
const allowedRoles = ["Business Team", "Enablement", "Approver", "General Reader"] as const;
const allowedVisibility = ["Public", "Draft", "Private"] as const;
const allowedInvestmentRequestTypes = ["Payroll / Headcount", "Non-Payroll"] as const;
const allowedInvestmentRequestStatuses = ["Draft", "Submitted"] as const;
const placeholderApproverNames = ["M. Rivera", "A. Chen", "S. Williams"];
const adminEmail = "wodonnell@prologis.com";
const cleanMemoContentMarker = "2026-06-23-clean-memo-section-content";
const cleanWorkflowTestDataMarker = "2026-06-24-clean-workflow-test-data";

export function toRouteErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "Unexpected error";
  if (message.includes("no such table")) {
    return "The D1 tables are unavailable. The app can create them during local development, but the hosted database must have the generated Drizzle migration applied.";
  }
  return message;
}

export function resolvePlanId(value?: string | null) {
  const requested = value?.trim();
  return businessPlanWorkstreams.find((workstream) => workstream.id === requested)?.id ?? DEFAULT_PLAN_ID;
}

export async function getActorFromRequest(request: Request): Promise<Actor> {
  const identity = resolveActorIdentityFromRequest(request);
  const d1 = getD1();
  await ensureSchema(d1);
  await ensureUserProfile(d1, identity.email, identity.displayName);

  const row = await d1
    .prepare("SELECT email, display_name, role FROM user_profiles WHERE email = ?")
    .bind(identity.email)
    .first<{ email: string; display_name: string | null; role: Role }>();

  return {
    email: identity.email,
    displayName: row?.display_name?.trim() || identity.displayName || displayNameFromEmail(identity.email),
    role: normalize(row?.role, allowedRoles, identity.email === adminEmail ? "Business Team" : "General Reader"),
  };
}

export function getWorkstreamByPlanId(planId: string): BusinessPlanWorkstream {
  return businessPlanWorkstreams.find((workstream) => workstream.id === planId) ?? businessPlanWorkstreams[0];
}

export async function getWorkspacePlan(planIdInput?: string | null, actorInput?: Actor): Promise<WorkspacePlan> {
  const planId = resolvePlanId(planIdInput);
  const d1 = getD1();
  await ensureSchema(d1);
  await ensureDefaultWorkstreams(d1);
  const actor = actorInput ?? {
    email: adminEmail,
    displayName: displayNameFromEmail(adminEmail),
    role: "Business Team" as Role,
  };

  const plan = await d1
    .prepare(
      "SELECT id, title, team_name, approval_state, approval_posture FROM business_plans WHERE id = ?",
    )
    .bind(planId)
    .first<BusinessPlanRow>();

  if (!plan) {
    throw new Error("Default business plan could not be loaded.");
  }

  const sections = await d1
    .prepare(
      "SELECT id, section_key, title, position, content, status FROM memo_sections WHERE plan_id = ? ORDER BY position ASC",
    )
    .bind(planId)
    .all<SectionRow>();

  const questions = await d1
    .prepare(
      "SELECT id, section_id, author_name, author_role, visibility, status, issue_type, function_name, body, response FROM section_questions WHERE plan_id = ? ORDER BY created_at DESC",
    )
    .bind(planId)
    .all<QuestionRow>();

  const approvers = await d1
    .prepare("SELECT id, name, title, posture FROM approvers WHERE plan_id = ? ORDER BY name ASC")
    .bind(planId)
    .all<ApproverRow>();

  const groups = await d1
    .prepare("SELECT id, group_type, name, description FROM collaborative_groups WHERE plan_id = ? ORDER BY group_type ASC, name ASC")
    .bind(planId)
    .all<GroupRow>();

  const activity = await d1
    .prepare(
      "SELECT id, actor_email, actor_role, object_type, object_id, action, old_value, new_value, created_at FROM activity_events WHERE plan_id = ? ORDER BY created_at DESC LIMIT 50",
    )
    .bind(planId)
    .all<ActivityRow>();

  return {
    id: plan.id,
    title: plan.title,
    teamName: plan.team_name,
    approvalState: plan.approval_state,
    approvalPosture: plan.approval_posture,
    user: actor,
    sections: (sections.results ?? []).map((section) => {
      const defaults = sectionDefaults.find((item) => item.key === section.section_key);
      return {
        id: section.id,
        sectionKey: section.section_key,
        title: section.title,
        prompt: defaults?.prompt ?? "",
        format: defaults?.format ?? "",
        emphasize: defaults?.emphasize ?? "",
        avoid: defaults?.avoid ?? "",
        content: section.content,
        status: section.status,
      };
    }),
    questions: (questions.results ?? []).map(toQuestion),
    approvers: (approvers.results ?? []).map(toApprover),
    groups: (groups.results ?? []).map(toGroup),
    activity: (activity.results ?? []).map(toActivityEvent),
  };
}

export async function updatePlan(input: {
  planId?: string;
  teamName?: string;
  approvalState?: SectionStatus;
  approvalPosture?: string;
}, actor: Actor) {
  assertCan(actor, "manage_plan");
  const planId = resolvePlanId(input.planId);
  const d1 = getD1();
  await ensureSchema(d1);
  await ensureDefaultWorkstreams(d1);

  const current = await d1
    .prepare("SELECT team_name, approval_state, approval_posture FROM business_plans WHERE id = ?")
    .bind(planId)
    .first<{ team_name: string; approval_state: SectionStatus; approval_posture: string }>();

  const teamName = input.teamName?.trim() ?? current?.team_name ?? "";
  const title = `2027 ${teamName || "[Team Name]"} Business Plan`;
  const approvalState = normalize(input.approvalState, allowedSectionStatuses, current?.approval_state ?? "Draft");
  const approvalPosture = input.approvalPosture?.trim() ?? current?.approval_posture ?? "Drafting";

  await d1
    .prepare(
      "UPDATE business_plans SET title = ?, team_name = ?, approval_state = ?, approval_posture = ?, updated_at = ? WHERE id = ?",
    )
    .bind(title, teamName, approvalState, approvalPosture, Date.now(), planId)
    .run();
  await recordActivity(d1, planId, actor, "business_plan", planId, "plan.updated", current, {
    teamName,
    approvalState,
    approvalPosture,
  });
}

export async function updateSection(
  id: string,
  input: { planId?: string; content?: string; status?: SectionStatus },
  actor: Actor,
) {
  assertCan(actor, "edit_memo");
  const planId = resolvePlanId(input.planId);
  const d1 = getD1();
  await ensureSchema(d1);
  await ensureDefaultWorkstreams(d1);

  const current = await d1
    .prepare("SELECT content, status FROM memo_sections WHERE id = ? AND plan_id = ?")
    .bind(id, planId)
    .first<{ content: string; status: SectionStatus }>();

  if (!current) {
    throw new Error("Section not found.");
  }

  const nextContent = input.content ?? current.content;
  const nextStatus = normalize(input.status, allowedSectionStatuses, current.status);
  await d1
    .prepare("UPDATE memo_sections SET content = ?, status = ?, updated_at = ? WHERE id = ? AND plan_id = ?")
    .bind(nextContent, nextStatus, Date.now(), id, planId)
    .run();
  await recordActivity(d1, planId, actor, "memo_section", id, "section.updated", current, {
    content: nextContent,
    status: nextStatus,
  });
}

export async function createQuestion(input: {
  planId?: string;
  sectionId?: string;
  visibility?: Visibility;
  issueType?: IssueType;
  functionName?: EnablementFunction | "";
  body?: string;
}, actor: Actor) {
  assertCan(actor, "create_question");
  const planId = resolvePlanId(input.planId);
  const d1 = getD1();
  await ensureSchema(d1);
  await ensureDefaultWorkstreams(d1);

  const sectionId = input.sectionId?.trim() ?? "";
  const body = input.body?.trim() ?? "";
  if (!sectionId || !body) {
    throw new Error("sectionId and body are required.");
  }

  const section = await d1
    .prepare("SELECT id FROM memo_sections WHERE id = ? AND plan_id = ?")
    .bind(sectionId, planId)
    .first<{ id: string }>();

  if (!section) {
    throw new Error("Section not found.");
  }

  const role = questionRoleForActor(actor);
  const author = actor.displayName || displayNameFromEmail(actor.email);
  const existingQuestion = await d1
    .prepare(
      "SELECT id FROM section_questions WHERE plan_id = ? AND section_id = ? AND author_name = ? AND author_role = ? AND body = ? LIMIT 1",
    )
    .bind(planId, sectionId, author, role, body)
    .first<{ id: string }>();

  if (existingQuestion) {
    return;
  }

  const now = Date.now();
  const questionId = crypto.randomUUID();
  await d1
    .prepare(
      "INSERT INTO section_questions (id, plan_id, section_id, author_name, author_role, visibility, status, issue_type, function_name, body, response, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(
      questionId,
      planId,
      sectionId,
      author,
      role,
      normalize(input.visibility, allowedVisibility, "Public"),
      "Open",
      normalize(input.issueType, allowedIssueTypes, role === "Approver" ? "Approval Concern" : "Clarification"),
      normalize(input.functionName, allowedEnablementFunctions, ""),
      body,
      null,
      now,
      now,
    )
    .run();
  await recordActivity(d1, planId, actor, "question", questionId, "question.created", null, {
    sectionId,
    visibility: normalize(input.visibility, allowedVisibility, "Public"),
    issueType: normalize(input.issueType, allowedIssueTypes, role === "Approver" ? "Approval Concern" : "Clarification"),
    functionName: normalize(input.functionName, allowedEnablementFunctions, ""),
    body,
  });
}

export async function updateQuestion(
  id: string,
  input: { planId?: string; status?: QuestionStatus; response?: string },
  actor: Actor,
) {
  assertCan(actor, "update_question");
  const planId = resolvePlanId(input.planId);
  const d1 = getD1();
  await ensureSchema(d1);
  await ensureDefaultWorkstreams(d1);

  const current = await d1
    .prepare("SELECT status, response, author_role, author_name FROM section_questions WHERE id = ? AND plan_id = ?")
    .bind(id, planId)
    .first<{ status: QuestionStatus; response: string | null; author_role: Role; author_name: string }>();

  if (!current) {
    throw new Error("Question not found.");
  }

  if (typeof input.response === "string" && actor.role !== "Business Team") {
    throw new Error("Only Business Team can respond to questions.");
  }

  const actingRole = questionRoleForActor(actor);
  const nextStatus = normalize(input.status, allowedQuestionStatuses, current.status);
  if (input.status && !allowedQuestionStatusForRole(actingRole, nextStatus)) {
    throw new Error("This role cannot set that question status.");
  }

  await d1
    .prepare("UPDATE section_questions SET status = ?, response = ?, updated_at = ? WHERE id = ? AND plan_id = ?")
    .bind(
      nextStatus,
      input.response ?? current.response,
      Date.now(),
      id,
      planId,
    )
    .run();
  await recordActivity(d1, planId, actor, "question", id, "question.updated", current, {
    status: nextStatus,
    response: input.response ?? current.response,
  });
}

export async function deleteQuestion(id: string, planIdInput: string | null | undefined, actor: Actor) {
  assertCan(actor, "delete_question");
  const planId = resolvePlanId(planIdInput);
  const d1 = getD1();
  await ensureSchema(d1);
  await ensureDefaultWorkstreams(d1);

  const question = await d1
    .prepare("SELECT author_role, author_name, body, status FROM section_questions WHERE id = ? AND plan_id = ?")
    .bind(id, planId)
    .first<{ author_role: Role; author_name: string; body: string; status: QuestionStatus }>();

  if (!question) {
    throw new Error("Question not found.");
  }

  const actingRole = questionRoleForActor(actor);
  if (actingRole !== "Business Team" && actingRole !== question.author_role) {
    throw new Error("Only the submitting role or Business Team can delete this question.");
  }

  await d1.prepare("DELETE FROM section_questions WHERE id = ? AND plan_id = ?").bind(id, planId).run();
  await recordActivity(d1, planId, actor, "question", id, "question.deleted", question, null);
}

export async function createApprover(input: { planId?: string; name?: string; title?: string; posture?: string }, actor: Actor) {
  assertCan(actor, "manage_approvers");
  const planId = resolvePlanId(input.planId);
  const d1 = getD1();
  await ensureSchema(d1);
  await ensureDefaultWorkstreams(d1);

  const name = input.name?.trim();
  if (!name) {
    throw new Error("name is required.");
  }

  const now = Date.now();
  const approverId = `${planId}-approver-${slug(name)}-${now}`;
  await d1
    .prepare(
      "INSERT INTO approvers (id, plan_id, name, title, posture, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
    )
    .bind(
      approverId,
      planId,
      name,
      input.title?.trim() || "Approver",
      input.posture?.trim() || "Reviewing",
      now,
    )
    .run();
  await recordActivity(d1, planId, actor, "approver", approverId, "approver.created", null, {
    name,
    title: input.title?.trim() || "Approver",
    posture: input.posture?.trim() || "Reviewing",
  });
}

export async function updateApprover(id: string, input: { planId?: string; posture?: string }, actor: Actor) {
  assertCan(actor, "approval_write");
  const planId = resolvePlanId(input.planId);
  const d1 = getD1();
  await ensureSchema(d1);
  await ensureDefaultWorkstreams(d1);

  const posture = input.posture?.trim();
  if (!posture) {
    throw new Error("posture is required.");
  }

  const current = await d1
    .prepare("SELECT name, title, posture FROM approvers WHERE id = ? AND plan_id = ?")
    .bind(id, planId)
    .first<{ name: string; title: string; posture: string }>();

  if (!current) {
    throw new Error("Approver not found.");
  }

  const result = await d1
    .prepare("UPDATE approvers SET posture = ?, updated_at = ? WHERE id = ? AND plan_id = ?")
    .bind(posture, Date.now(), id, planId)
    .run();

  if (!result.meta.rows_written) {
    throw new Error("Approver not found.");
  }
  await recordActivity(d1, planId, actor, "approver", id, "approval.updated", current, {
    ...current,
    posture,
  });
}

export async function createSection(input: {
  planId?: string;
  title?: string;
  content?: string;
  status?: SectionStatus;
}, actor: Actor) {
  assertCan(actor, "manage_structure");
  const planId = resolvePlanId(input.planId);
  const d1 = getD1();
  await ensureSchema(d1);
  await ensureDefaultWorkstreams(d1);

  const title = input.title?.trim();
  if (!title) {
    throw new Error("title is required.");
  }

  const maxPosition = await d1
    .prepare("SELECT MAX(position) AS max_position FROM memo_sections WHERE plan_id = ?")
    .bind(planId)
    .first<{ max_position: number | null }>();
  const now = Date.now();
  const sectionId = `${planId}-section-${slug(title)}-${now}`;
  const nextSection = {
    title,
    content: input.content?.trim() ?? "",
    status: normalize(input.status, allowedSectionStatuses, "Draft"),
  };

  await d1
    .prepare(
      "INSERT INTO memo_sections (id, plan_id, section_key, title, position, requirement, content, status, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(
      sectionId,
      planId,
      `custom-${slug(title)}-${now}`,
      title,
      (maxPosition?.max_position ?? 0) + 1,
      "",
      nextSection.content,
      nextSection.status,
      now,
    )
    .run();
  await recordActivity(d1, planId, actor, "memo_section", sectionId, "section.created", null, nextSection);
}

export async function createCollaborativeGroup(input: {
  planId?: string;
  groupType?: "Enablement" | "Advisor";
  name?: string;
  description?: string;
}, actor: Actor) {
  assertCan(actor, "manage_structure");
  const planId = resolvePlanId(input.planId);
  const d1 = getD1();
  await ensureSchema(d1);
  await ensureDefaultWorkstreams(d1);

  const name = input.name?.trim();
  if (!name) {
    throw new Error("name is required.");
  }

  const groupType = input.groupType === "Advisor" ? "Advisor" : "Enablement";
  const now = Date.now();
  const groupId = `${planId}-${groupType.toLowerCase()}-${slug(name)}-${now}`;
  const nextGroup = {
    groupType,
    name,
    description: input.description?.trim() ?? "",
  };

  await d1
    .prepare(
      "INSERT INTO collaborative_groups (id, plan_id, group_type, name, description, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(groupId, planId, groupType, name, nextGroup.description, actor.email, now, now)
    .run();
  await recordActivity(d1, planId, actor, "collaborative_group", groupId, "group.created", null, nextGroup);
}

export async function getInvestmentRequests(planIdInput?: string | null, searchInput?: string | null) {
  const planId = resolvePlanId(planIdInput);
  const d1 = getD1();
  await ensureSchema(d1);
  await ensureDefaultWorkstreams(d1);

  const requests = await d1
    .prepare(
      "SELECT id, plan_id, request_type, status, owner_name, owner_email, initiative, strategic_objective, milestone, alternatives, measurable_outcome, not_approved_impact, created_at, updated_at, submitted_at FROM investment_requests WHERE plan_id = ? ORDER BY updated_at DESC",
    )
    .bind(planId)
    .all<InvestmentRequestRow>();

  const ids = (requests.results ?? []).map((request) => request.id);
  const lineRows: InvestmentRequestLineRow[] = [];
  for (const id of ids) {
    const rows = await d1
      .prepare(
        "SELECT id, request_id, line_type, position, line_data FROM investment_request_lines WHERE request_id = ? ORDER BY position ASC",
      )
      .bind(id)
      .all<InvestmentRequestLineRow>();
    lineRows.push(...(rows.results ?? []));
  }

  const search = searchInput?.trim().toLowerCase() ?? "";
  return (requests.results ?? [])
    .map((request) => toInvestmentRequest(request, lineRows.filter((line) => line.request_id === request.id)))
    .filter((request) => !search || investmentRequestMatchesSearch(request, search));
}

export async function createInvestmentRequest(input: Partial<InvestmentRequest>, actor: Actor) {
  assertCan(actor, "investment_write");
  const planId = resolvePlanId(input.planId);
  const requestType = normalize(input.requestType, allowedInvestmentRequestTypes, "Payroll / Headcount");
  const now = Date.now();
  const requestId = crypto.randomUUID();
  const lineId = crypto.randomUUID();
  const initialLine = sanitizeInvestmentLine({ ...emptyInvestmentRequestLine, id: lineId, lineType: requestType }, requestType, planId);
  const request = sanitizeInvestmentRequest(input, requestType, actor, now, null);

  const d1 = getD1();
  await ensureSchema(d1);
  await ensureDefaultWorkstreams(d1);
  await d1.batch([
    d1
      .prepare(
        "INSERT INTO investment_requests (id, plan_id, request_type, status, owner_name, owner_email, initiative, strategic_objective, milestone, alternatives, measurable_outcome, not_approved_impact, created_by, created_at, updated_at, submitted_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      )
      .bind(
        requestId,
        planId,
        requestType,
        "Draft",
        request.ownerName,
        request.ownerEmail,
        request.initiative,
        request.strategicObjective,
        request.milestone,
        request.alternatives,
        request.measurableOutcome,
        request.notApprovedImpact,
        actor.email,
        now,
        now,
        null,
      ),
    d1
      .prepare(
        "INSERT INTO investment_request_lines (id, request_id, line_type, position, line_data, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
      )
      .bind(lineId, requestId, requestType, 1, JSON.stringify(initialLine), now, now),
  ]);
  await recordActivity(d1, planId, actor, "investment_request", requestId, "investment_request.created", null, {
    requestType,
    initiative: request.initiative,
  });
  return getInvestmentRequest(requestId, planId);
}

export async function updateInvestmentRequest(
  id: string,
  input: Partial<InvestmentRequest> & { submit?: boolean },
  actor: Actor,
) {
  assertCan(actor, "investment_write");
  const planId = resolvePlanId(input.planId);
  const d1 = getD1();
  await ensureSchema(d1);
  await ensureDefaultWorkstreams(d1);

  const current = await getInvestmentRequest(id, planId);
  if (!current) {
    throw new Error("Investment request not found.");
  }

  const requestType = normalize(input.requestType, allowedInvestmentRequestTypes, current.requestType);
  const status = input.submit ? "Submitted" : normalize(input.status, allowedInvestmentRequestStatuses, current.status);
  const now = Date.now();
  const next = sanitizeInvestmentRequest({ ...current, ...input, status }, requestType, actor, now, input.submit ? now : current.submittedAt);
  const lines = normalizeInvestmentLines(input.lines?.length ? input.lines : current.lines, requestType, planId);

  if (input.submit) {
    const errors = validateInvestmentRequest({ ...next, id, planId, requestType, status, createdAt: current.createdAt, lines });
    if (errors.length > 0) {
      throw new Error(errors.join(" "));
    }
  }

  await d1.batch([
    d1
      .prepare(
        "UPDATE investment_requests SET request_type = ?, status = ?, owner_name = ?, owner_email = ?, initiative = ?, strategic_objective = ?, milestone = ?, alternatives = ?, measurable_outcome = ?, not_approved_impact = ?, updated_at = ?, submitted_at = ? WHERE id = ? AND plan_id = ?",
      )
      .bind(
        requestType,
        status,
        next.ownerName,
        next.ownerEmail,
        next.initiative,
        next.strategicObjective,
        next.milestone,
        next.alternatives,
        next.measurableOutcome,
        next.notApprovedImpact,
        now,
        input.submit ? now : current.submittedAt,
        id,
        planId,
      ),
    d1.prepare("DELETE FROM investment_request_lines WHERE request_id = ?").bind(id),
    ...lines.map((line, index) =>
      d1
        .prepare(
          "INSERT INTO investment_request_lines (id, request_id, line_type, position, line_data, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(line.id || crypto.randomUUID(), id, requestType, index + 1, JSON.stringify(line), now, now),
    ),
  ]);
  await recordActivity(d1, planId, actor, "investment_request", id, input.submit ? "investment_request.submitted" : "investment_request.updated", current, {
    ...next,
    lineCount: lines.length,
  });
  return getInvestmentRequest(id, planId);
}

export async function deleteInvestmentRequest(id: string, planIdInput: string | null | undefined, actor: Actor) {
  assertCan(actor, "investment_write");
  const planId = resolvePlanId(planIdInput);
  const d1 = getD1();
  await ensureSchema(d1);
  await ensureDefaultWorkstreams(d1);

  const current = await getInvestmentRequest(id, planId);
  if (!current) {
    throw new Error("Investment request not found.");
  }

  await d1.batch([
    d1.prepare("DELETE FROM investment_request_lines WHERE request_id = ?").bind(id),
    d1.prepare("DELETE FROM investment_requests WHERE id = ? AND plan_id = ?").bind(id, planId),
  ]);
  await recordActivity(d1, planId, actor, "investment_request", id, "investment_request.deleted", current, null);
}

export async function getInvestmentRequestExport(id: string, planIdInput?: string | null): Promise<InvestmentRequestExport> {
  const planId = resolvePlanId(planIdInput);
  const request = await getInvestmentRequest(id, planId);
  if (!request) {
    throw new Error("Investment request not found.");
  }
  const profile = investmentWorkbookProfiles[planId];
  if (!profile) {
    throw new Error("No workbook template is configured for this business plan.");
  }

  const hasGroups = profile.groups.length > 0;
  const payrollHeaders = hasGroups
    ? ["Job Title", "Group", "Role / Hire", "Location (City/Country)", "Key Job Responsibilities", "Hire Date", "Notes / Rationale"]
    : ["Job Title", "Role / Hire", "Location (City/Country)", "Key Job Responsibilities", "Hire Date", "Notes / Rationale"];
  const nonPayrollHeaders = hasGroups
    ? ["Expense Description", "Group", "Type of Expense", "Vendor", "Annualized Spend", "Notes / Rationale"]
    : ["Expense Description", "Type of Expense", "Vendor", "Annualized Spend", "Notes / Rationale"];

  const payrollRows = request.lines
    .filter((line) => line.lineType === "Payroll / Headcount")
    .map((line) =>
      hasGroups
        ? [line.jobTitle, line.group, line.roleHire, line.location, line.responsibilities, line.hireDate, line.notesRationale]
        : [line.jobTitle, line.roleHire, line.location, line.responsibilities, line.hireDate, line.notesRationale],
    );
  const nonPayrollRows = request.lines
    .filter((line) => line.lineType === "Non-Payroll")
    .map((line) =>
      hasGroups
        ? [line.expenseDescription, line.group, line.expenseType, line.vendor, currencyForExport(line.annualizedSpend), line.notesRationale]
        : [line.expenseDescription, line.expenseType, line.vendor, currencyForExport(line.annualizedSpend), line.notesRationale],
    );

  return {
    requestId: request.id,
    workbookName: profile.workbookName,
    targetSheet: "Investment Case Asks - Monthly",
    payrollRange: profile.payrollInputRange,
    nonPayrollRange: profile.nonPayrollInputRange,
    payrollTsv: toTsv(payrollHeaders, payrollRows),
    nonPayrollTsv: toTsv(nonPayrollHeaders, nonPayrollRows),
  };
}

export async function getInvestmentRequest(id: string, planId: string) {
  const d1 = getD1();
  const request = await d1
    .prepare(
      "SELECT id, plan_id, request_type, status, owner_name, owner_email, initiative, strategic_objective, milestone, alternatives, measurable_outcome, not_approved_impact, created_at, updated_at, submitted_at FROM investment_requests WHERE id = ? AND plan_id = ?",
    )
    .bind(id, planId)
    .first<InvestmentRequestRow>();
  if (!request) {
    return null;
  }
  const lines = await d1
    .prepare("SELECT id, request_id, line_type, position, line_data FROM investment_request_lines WHERE request_id = ? ORDER BY position ASC")
    .bind(id)
    .all<InvestmentRequestLineRow>();
  return toInvestmentRequest(request, lines.results ?? []);
}

function sanitizeInvestmentRequest(
  input: Partial<InvestmentRequest>,
  requestType: InvestmentRequestType,
  actor: Actor,
  updatedAt: number,
  submittedAt: number | null,
) {
  return {
    requestType,
    status: normalize(input.status, allowedInvestmentRequestStatuses, "Draft"),
    ownerName: input.ownerName?.trim() || actor.displayName || displayNameFromEmail(actor.email),
    ownerEmail: normalizeEmail(input.ownerEmail) ?? actor.email,
    initiative: input.initiative?.trim() ?? "",
    strategicObjective: input.strategicObjective?.trim() ?? "",
    milestone: input.milestone?.trim() ?? "",
    alternatives: input.alternatives?.trim() ?? "",
    measurableOutcome: input.measurableOutcome?.trim() ?? "",
    notApprovedImpact: input.notApprovedImpact?.trim() ?? "",
    updatedAt,
    submittedAt,
  };
}

function normalizeInvestmentLines(lines: InvestmentRequestLine[], requestType: InvestmentRequestType, planId: string) {
  const normalized = lines
    .filter((line) => line.lineType === requestType)
    .map((line) => sanitizeInvestmentLine(line, requestType, planId));
  if (normalized.length > 0) {
    return normalized;
  }
  return [sanitizeInvestmentLine({ ...emptyInvestmentRequestLine, id: crypto.randomUUID(), lineType: requestType }, requestType, planId)];
}

function sanitizeInvestmentLine(line: Partial<InvestmentRequestLine>, requestType: InvestmentRequestType, planId: string): InvestmentRequestLine {
  const profile = investmentWorkbookProfiles[planId];
  if (!profile) {
    throw new Error("No G&A investment workbook is configured for this business plan.");
  }
  const group = line.group?.trim() ?? "";
  const expenseType = line.expenseType?.trim() ?? "";
  return {
    ...emptyInvestmentRequestLine,
    id: line.id || crypto.randomUUID(),
    lineType: requestType,
    jobTitle: line.jobTitle?.trim() ?? "",
    group: profile.groups.length && profile.groups.includes(group) ? group : "",
    roleHire: line.roleHire?.trim() ?? "",
    location: line.location?.trim() ?? "",
    responsibilities: line.responsibilities?.trim() ?? "",
    hireDate: line.hireDate?.trim() ?? "",
    expenseDescription: line.expenseDescription?.trim() ?? "",
    expenseType: profile.expenseTypes.includes(expenseType) ? expenseType : "",
    vendor: line.vendor?.trim() ?? "",
    annualizedSpend: toNullableNumber(line.annualizedSpend),
    notesRationale: line.notesRationale?.trim() ?? "",
  };
}

function validateInvestmentRequest(request: InvestmentRequest) {
  const profile = investmentWorkbookProfiles[request.planId];
  const errors: string[] = [];
  if (!profile) errors.push("No workbook template is configured for this plan.");
  if (!request.ownerName.trim()) errors.push("Owner is required.");
  if (!request.initiative.trim()) errors.push("Title is required.");
  if (!request.strategicObjective.trim()) errors.push("Strategic objective is required.");
  if (!request.milestone.trim()) errors.push("Milestone is required.");
  if (!request.alternatives.trim()) errors.push("Alternatives considered are required.");
  if (!request.measurableOutcome.trim()) errors.push("Measurable outcome is required.");
  if (!request.notApprovedImpact.trim()) errors.push("Impact if not approved is required.");
  if (request.lines.length === 0) errors.push("At least one request line is required.");

  for (const [index, line] of request.lines.entries()) {
    const row = index + 1;
    if (profile?.groups.length && !line.group) errors.push(`Line ${row}: group is required.`);
    if (request.requestType === "Payroll / Headcount") {
      if (!line.jobTitle.trim()) errors.push(`Line ${row}: job title is required.`);
      if (!line.roleHire.trim()) errors.push(`Line ${row}: role / hire is required.`);
      if (!line.location.trim()) errors.push(`Line ${row}: location is required.`);
      if (!line.responsibilities.trim()) errors.push(`Line ${row}: responsibilities are required.`);
      if (!line.hireDate.trim()) errors.push(`Line ${row}: hire date is required.`);
    } else {
      if (!line.expenseDescription.trim()) errors.push(`Line ${row}: expense description is required.`);
      if (!line.expenseType.trim()) errors.push(`Line ${row}: type of expense is required.`);
      if (line.annualizedSpend == null || line.annualizedSpend < 0) {
        errors.push(`Line ${row}: annualized spend must be zero or greater.`);
      }
    }
    if (!line.notesRationale.trim()) errors.push(`Line ${row}: notes / rationale is required.`);
  }
  return errors;
}

function investmentRequestMatchesSearch(request: InvestmentRequest, search: string) {
  const haystack = [
    request.requestType,
    request.status,
    request.ownerName,
    request.ownerEmail,
    request.initiative,
    request.strategicObjective,
    request.milestone,
    request.alternatives,
    request.measurableOutcome,
    request.notApprovedImpact,
    ...request.lines.flatMap((line) => [
      line.jobTitle,
      line.group,
      line.roleHire,
      line.location,
      line.responsibilities,
      line.expenseDescription,
      line.expenseType,
      line.vendor,
      line.notesRationale,
    ]),
  ]
    .join(" ")
    .toLowerCase();
  return haystack.includes(search);
}

function toNullableNumber(value: unknown) {
  if (value === "" || value == null) return null;
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? number : null;
}

function currencyForExport(value: number | null) {
  return value == null ? "" : String(Math.round(value));
}

function toTsv(headers: string[], rows: Array<Array<string | number>>) {
  return [headers, ...rows].map((row) => row.map((cell) => String(cell ?? "").replace(/\t|\r?\n/g, " ")).join("\t")).join("\n");
}

async function ensureSchema(d1: D1Database) {
  const statements = [
    "CREATE TABLE IF NOT EXISTS business_plans (id text PRIMARY KEY NOT NULL, title text NOT NULL, team_name text NOT NULL, approval_state text DEFAULT 'Draft' NOT NULL, approval_posture text DEFAULT 'Drafting' NOT NULL, created_by text, updated_at integer NOT NULL)",
    "CREATE TABLE IF NOT EXISTS memo_sections (id text PRIMARY KEY NOT NULL, plan_id text NOT NULL, section_key text NOT NULL, title text NOT NULL, position integer NOT NULL, requirement text DEFAULT '' NOT NULL, content text DEFAULT '' NOT NULL, status text DEFAULT 'Draft' NOT NULL, updated_at integer NOT NULL, FOREIGN KEY (plan_id) REFERENCES business_plans(id) ON DELETE cascade)",
    "CREATE TABLE IF NOT EXISTS section_questions (id text PRIMARY KEY NOT NULL, plan_id text NOT NULL, section_id text NOT NULL, author_name text NOT NULL, author_role text NOT NULL, visibility text DEFAULT 'Public' NOT NULL, status text DEFAULT 'Open' NOT NULL, issue_type text DEFAULT 'Clarification' NOT NULL, function_name text DEFAULT '' NOT NULL, body text NOT NULL, response text, created_at integer NOT NULL, updated_at integer NOT NULL, FOREIGN KEY (plan_id) REFERENCES business_plans(id) ON DELETE cascade, FOREIGN KEY (section_id) REFERENCES memo_sections(id) ON DELETE cascade)",
    "CREATE TABLE IF NOT EXISTS approvers (id text PRIMARY KEY NOT NULL, plan_id text NOT NULL, name text NOT NULL, title text NOT NULL, posture text DEFAULT 'Reviewing' NOT NULL, updated_at integer NOT NULL, FOREIGN KEY (plan_id) REFERENCES business_plans(id) ON DELETE cascade)",
    "CREATE TABLE IF NOT EXISTS user_profiles (email text PRIMARY KEY NOT NULL, display_name text, role text DEFAULT 'General Reader' NOT NULL, created_at integer NOT NULL, updated_at integer NOT NULL)",
    "CREATE TABLE IF NOT EXISTS collaborative_groups (id text PRIMARY KEY NOT NULL, plan_id text NOT NULL, group_type text NOT NULL, name text NOT NULL, description text DEFAULT '' NOT NULL, created_by text NOT NULL, created_at integer NOT NULL, updated_at integer NOT NULL, FOREIGN KEY (plan_id) REFERENCES business_plans(id) ON DELETE cascade)",
    "CREATE TABLE IF NOT EXISTS activity_events (id text PRIMARY KEY NOT NULL, plan_id text NOT NULL, actor_email text NOT NULL, actor_role text NOT NULL, object_type text NOT NULL, object_id text NOT NULL, action text NOT NULL, old_value text, new_value text, created_at integer NOT NULL, FOREIGN KEY (plan_id) REFERENCES business_plans(id) ON DELETE cascade)",
    "CREATE TABLE IF NOT EXISTS investment_requests (id text PRIMARY KEY NOT NULL, plan_id text NOT NULL, request_type text NOT NULL, status text DEFAULT 'Draft' NOT NULL, owner_name text DEFAULT '' NOT NULL, owner_email text DEFAULT '' NOT NULL, initiative text DEFAULT '' NOT NULL, strategic_objective text DEFAULT '' NOT NULL, milestone text DEFAULT '' NOT NULL, alternatives text DEFAULT '' NOT NULL, measurable_outcome text DEFAULT '' NOT NULL, not_approved_impact text DEFAULT '' NOT NULL, created_by text NOT NULL, created_at integer NOT NULL, updated_at integer NOT NULL, submitted_at integer, FOREIGN KEY (plan_id) REFERENCES business_plans(id) ON DELETE cascade)",
    "CREATE TABLE IF NOT EXISTS investment_request_lines (id text PRIMARY KEY NOT NULL, request_id text NOT NULL, line_type text NOT NULL, position integer NOT NULL, line_data text NOT NULL, created_at integer NOT NULL, updated_at integer NOT NULL, FOREIGN KEY (request_id) REFERENCES investment_requests(id) ON DELETE cascade)",
    "CREATE TABLE IF NOT EXISTS app_meta (key text PRIMARY KEY NOT NULL, value text NOT NULL, updated_at integer NOT NULL)",
  ];

  for (const statement of statements) {
    await d1.prepare(statement).run();
  }

  await addColumnIfMissing(d1, "business_plans", "approval_state", "text DEFAULT 'Draft' NOT NULL");
  await addColumnIfMissing(d1, "business_plans", "approval_posture", "text DEFAULT 'Drafting' NOT NULL");
  await addColumnIfMissing(d1, "business_plans", "created_by", "text");
  await addColumnIfMissing(d1, "memo_sections", "section_key", "text");
  await addColumnIfMissing(d1, "memo_sections", "requirement", "text DEFAULT '' NOT NULL");
  await addColumnIfMissing(d1, "section_questions", "issue_type", "text DEFAULT 'Clarification' NOT NULL");
  await addColumnIfMissing(d1, "section_questions", "function_name", "text DEFAULT '' NOT NULL");
  await ensureUserProfile(d1, adminEmail);
  await backfillSectionKeys(d1);
  await clearExistingMemoContentOnce(d1);
  await clearWorkflowTestDataOnce(d1);
}

async function ensureDefaultWorkspace(d1: D1Database, planId: string) {
  const workstream = getWorkstreamByPlanId(planId);
  const existing = await d1
    .prepare("SELECT id, title, team_name FROM business_plans WHERE id = ?")
    .bind(planId)
    .first<{ id: string; title: string; team_name: string }>();

  if (existing) {
    if (shouldRestoreWorkstreamIdentity(existing, workstream)) {
      await d1
        .prepare("UPDATE business_plans SET title = ?, team_name = ?, updated_at = ? WHERE id = ?")
        .bind(workstream.title, workstream.teamName, Date.now(), planId)
        .run();
    }
    await ensureSectionDefaults(d1, planId);
    return;
  }

  const now = Date.now();
  await d1.batch([
    d1
      .prepare(
        "INSERT INTO business_plans (id, title, team_name, approval_state, approval_posture, created_by, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
      )
      .bind(planId, workstream.title, workstream.teamName, "Draft", "Drafting", null, now),
    ...sectionDefaults.map((section, index) =>
      d1
        .prepare(
          "INSERT INTO memo_sections (id, plan_id, section_key, title, position, requirement, content, status, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(
          `${planId}-${section.key}`,
          planId,
          section.key,
          section.title,
          index + 1,
          section.format,
          section.content,
          section.status,
          now,
        ),
    ),
    ...approverDefaults.map((approver) =>
      d1
        .prepare(
          "INSERT INTO approvers (id, plan_id, name, title, posture, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
        )
        .bind(`${planId}-approver-${slug(approver.name)}`, planId, approver.name, approver.title, approver.posture, now),
    ),
  ]);
}

async function ensureDefaultWorkstreams(d1: D1Database) {
  for (const workstream of businessPlanWorkstreams) {
    await ensureDefaultWorkspace(d1, workstream.id);
    await ensureApproverDefaults(d1, workstream.id);
  }
}

function shouldRestoreWorkstreamIdentity(
  existing: { title: string; team_name: string },
  workstream: BusinessPlanWorkstream,
) {
  if (existing.title.includes("[Team Name]") || !existing.team_name) {
    return true;
  }
  if (existing.title === workstream.title && existing.team_name === workstream.teamName) {
    return false;
  }
  return businessPlanWorkstreams.some(
    (item) =>
      item.id !== workstream.id &&
      (existing.title === item.title || existing.team_name === item.teamName),
  );
}

async function ensureSectionDefaults(d1: D1Database, planId: string) {
  const rows = await d1
    .prepare("SELECT section_key FROM memo_sections WHERE plan_id = ?")
    .bind(planId)
    .all<{ section_key?: string | null }>();

  const existingKeys = new Set((rows.results ?? []).map((row) => row.section_key).filter(Boolean));
  const missingSections = sectionDefaults.filter((section) => !existingKeys.has(section.key));
  if (missingSections.length === 0) {
    return;
  }

  const now = Date.now();
  await d1.batch(
    missingSections.map((section) =>
      d1
        .prepare(
          "INSERT INTO memo_sections (id, plan_id, section_key, title, position, requirement, content, status, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(
          `${planId}-${section.key}`,
          planId,
          section.key,
          section.title,
          sectionDefaults.findIndex((item) => item.key === section.key) + 1,
          section.format,
          section.content,
          section.status,
          now,
        ),
    ),
  );
}

async function ensureApproverDefaults(d1: D1Database, planId: string) {
  const rows = await d1
    .prepare("SELECT id, name FROM approvers WHERE plan_id = ?")
    .bind(planId)
    .all<{ id: string; name: string }>();

  const existingNames = new Set((rows.results ?? []).map((row) => row.name));
  const statements = [];
  const now = Date.now();

  for (const name of placeholderApproverNames) {
    if (existingNames.has(name)) {
      statements.push(
        d1.prepare("DELETE FROM approvers WHERE plan_id = ? AND name = ?").bind(planId, name),
      );
    }
  }

  for (const approver of approverDefaults) {
    if (!existingNames.has(approver.name)) {
      statements.push(
        d1
          .prepare(
            "INSERT INTO approvers (id, plan_id, name, title, posture, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
          )
          .bind(`${planId}-approver-${slug(approver.name)}`, planId, approver.name, approver.title, approver.posture, now),
      );
    }
  }

  statements.push(
    d1
      .prepare("UPDATE approvers SET posture = ?, updated_at = ? WHERE plan_id = ? AND posture IN (?, ?, ?)")
      .bind("Needs Revision", now, planId, "Reviewing", "Needs answers", "Supportive"),
  );

  if (statements.length > 0) {
    await d1.batch(statements);
  }
}

function toQuestion(row: QuestionRow): Question {
  const rowStatus = row.status as QuestionStatus | "Acknowledged";
  return {
    id: row.id,
    sectionId: row.section_id,
    author: row.author_name,
    role: row.author_role,
    visibility: row.visibility,
    status: normalize(rowStatus, allowedQuestionStatuses, rowStatus === "Acknowledged" ? "Answered" : "Open"),
    issueType: normalize(row.issue_type, allowedIssueTypes, "Clarification"),
    functionName: normalize(row.function_name, allowedEnablementFunctions, ""),
    body: row.body,
    response: row.response ?? "",
  };
}

function toApprover(row: ApproverRow): Approver {
  return {
    id: row.id,
    name: row.name,
    title: row.title,
    posture: row.posture,
  };
}

function toGroup(row: GroupRow): CollaborativeGroup {
  return {
    id: row.id,
    groupType: row.group_type,
    name: row.name,
    description: row.description,
  };
}

function toActivityEvent(row: ActivityRow): ActivityEvent {
  return {
    id: row.id,
    actorEmail: row.actor_email,
    actorRole: normalize(row.actor_role, allowedRoles, "General Reader"),
    objectType: row.object_type,
    objectId: row.object_id,
    action: row.action,
    oldValue: row.old_value ?? "",
    newValue: row.new_value ?? "",
    createdAt: row.created_at,
  };
}

function toInvestmentRequest(row: InvestmentRequestRow, lineRows: InvestmentRequestLineRow[]): InvestmentRequest {
  return {
    id: row.id,
    planId: row.plan_id,
    requestType: normalize(row.request_type, allowedInvestmentRequestTypes, "Payroll / Headcount"),
    status: normalize(row.status, allowedInvestmentRequestStatuses, "Draft"),
    ownerName: row.owner_name,
    ownerEmail: row.owner_email,
    initiative: row.initiative,
    strategicObjective: row.strategic_objective,
    milestone: row.milestone,
    alternatives: row.alternatives,
    measurableOutcome: row.measurable_outcome,
    notApprovedImpact: row.not_approved_impact,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    submittedAt: row.submitted_at,
    lines: lineRows.map((line) => parseInvestmentLine(line)).filter((line) => line.lineType === row.request_type),
  };
}

function parseInvestmentLine(row: InvestmentRequestLineRow): InvestmentRequestLine {
  let parsed: Partial<InvestmentRequestLine> = {};
  try {
    parsed = JSON.parse(row.line_data) as Partial<InvestmentRequestLine>;
  } catch {
    parsed = {};
  }
  return {
    ...emptyInvestmentRequestLine,
    ...parsed,
    id: row.id,
    lineType: normalize(row.line_type, allowedInvestmentRequestTypes, "Payroll / Headcount"),
  };
}

type Permission =
  | "manage_plan"
  | "edit_memo"
  | "create_question"
  | "update_question"
  | "delete_question"
  | "manage_approvers"
  | "approval_write"
  | "manage_structure"
  | "investment_write";

function assertCan(actor: Actor, permission: Permission) {
  if (actor.email === adminEmail) {
    return;
  }
  if (actor.role === "Business Team") {
    return;
  }
  if (actor.role === "Enablement") {
    if (permission === "create_question" || permission === "update_question" || permission === "delete_question") {
      return;
    }
  }
  if (actor.role === "Approver") {
    if (
      permission === "create_question" ||
      permission === "update_question" ||
      permission === "delete_question" ||
      permission === "approval_write"
    ) {
      return;
    }
  }
  throw new Error("Not authorized.");
}

function questionRoleForActor(actor: Actor): Exclude<Role, "General Reader"> {
  if (actor.role === "Approver") return "Approver";
  if (actor.role === "Enablement") return "Enablement";
  return "Business Team";
}

async function ensureUserProfile(d1: D1Database, email: string, displayName: string) {
  const now = Date.now();
  const existing = await d1
    .prepare("SELECT email, display_name FROM user_profiles WHERE email = ?")
    .bind(email)
    .first<{ email: string; display_name: string | null }>();
  if (existing) {
    const existingDisplayName = cleanDisplayName(existing.display_name);
    if (
      cleanDisplayName(displayName) &&
      (!existingDisplayName || existingDisplayName === displayNameFromEmail(email))
    ) {
      await d1
        .prepare("UPDATE user_profiles SET display_name = ?, updated_at = ? WHERE email = ?")
        .bind(displayName, now, email)
        .run();
    }
    return;
  }

  await d1
    .prepare("INSERT INTO user_profiles (email, display_name, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?)")
    .bind(
      email,
      displayName,
      email === adminEmail ? "Business Team" : "General Reader",
      now,
      now,
    )
    .run();
}

async function recordActivity(
  d1: D1Database,
  planId: string,
  actor: Actor,
  objectType: string,
  objectId: string,
  action: string,
  oldValue: unknown,
  newValue: unknown,
) {
  await d1
    .prepare(
      "INSERT INTO activity_events (id, plan_id, actor_email, actor_role, object_type, object_id, action, old_value, new_value, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(
      crypto.randomUUID(),
      planId,
      actor.email,
      actor.role,
      objectType,
      objectId,
      action,
      oldValue == null ? null : JSON.stringify(oldValue),
      newValue == null ? null : JSON.stringify(newValue),
      Date.now(),
    )
    .run();
}

function normalize<T extends readonly string[]>(value: unknown, allowed: T, fallback: T[number]): T[number] {
  return typeof value === "string" && allowed.includes(value) ? value : fallback;
}

function allowedQuestionStatusForRole(role: Role, status: QuestionStatus) {
  if (role === "Business Team") {
    return status === "Open" || status === "Answered" || status === "Resolved" || status === "No Change Needed";
  }
  return status === "Open" || status === "Reopened" || status === "Resolved";
}

async function addColumnIfMissing(d1: D1Database, table: string, column: string, definition: string) {
  const rows = await d1.prepare(`PRAGMA table_info(${table})`).all<{ name: string }>();
  if ((rows.results ?? []).some((row) => row.name === column)) {
    return;
  }
  await d1.prepare(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`).run();
}

async function clearExistingMemoContentOnce(d1: D1Database) {
  const existing = await d1
    .prepare("SELECT key FROM app_meta WHERE key = ?")
    .bind(cleanMemoContentMarker)
    .first<{ key: string }>();

  if (existing) {
    return;
  }

  const now = Date.now();
  await d1.batch([
    ...businessPlanWorkstreams.map((workstream) =>
      d1
        .prepare("UPDATE memo_sections SET content = '', updated_at = ? WHERE plan_id = ?")
        .bind(now, workstream.id),
    ),
    d1
      .prepare("INSERT INTO app_meta (key, value, updated_at) VALUES (?, ?, ?)")
      .bind(cleanMemoContentMarker, "done", now),
  ]);
}

async function clearWorkflowTestDataOnce(d1: D1Database) {
  const existing = await d1
    .prepare("SELECT key FROM app_meta WHERE key = ?")
    .bind(cleanWorkflowTestDataMarker)
    .first<{ key: string }>();

  if (existing) {
    return;
  }

  const now = Date.now();
  await d1.batch([
    ...businessPlanWorkstreams.flatMap((workstream) => [
      d1
        .prepare("UPDATE memo_sections SET content = '', updated_at = ? WHERE plan_id = ?")
        .bind(now, workstream.id),
      d1.prepare("DELETE FROM section_questions WHERE plan_id = ?").bind(workstream.id),
      d1.prepare("DELETE FROM approvers WHERE plan_id = ?").bind(workstream.id),
      d1
        .prepare(
          "UPDATE business_plans SET approval_state = ?, approval_posture = ?, updated_at = ? WHERE id = ?",
        )
        .bind("Draft", "Drafting", now, workstream.id),
    ]),
    d1
      .prepare("INSERT INTO app_meta (key, value, updated_at) VALUES (?, ?, ?)")
      .bind(cleanWorkflowTestDataMarker, "done", now),
  ]);
}

async function backfillSectionKeys(d1: D1Database) {
  const rows = await d1
    .prepare("SELECT id, plan_id, title, position, section_key FROM memo_sections ORDER BY plan_id ASC, position ASC")
    .all<{ id: string; plan_id: string; title: string; position: number; section_key?: string | null }>();

  const updates = [];

  for (const row of rows.results ?? []) {
    if (row.section_key?.trim()) {
      continue;
    }

    const byTitle = sectionDefaults.find((section) => section.title === row.title);
    const byPosition = Number.isInteger(row.position) ? sectionDefaults[row.position - 1] : undefined;
    const resolvedKey = byTitle?.key ?? byPosition?.key;

    if (!resolvedKey) {
      continue;
    }

    updates.push(
      d1.prepare("UPDATE memo_sections SET section_key = ? WHERE id = ? AND plan_id = ?").bind(resolvedKey, row.id, row.plan_id),
    );
  }

  if (updates.length > 0) {
    await d1.batch(updates);
  }
}

function slug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}
