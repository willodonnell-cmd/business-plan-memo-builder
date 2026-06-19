import { and, asc, eq, or } from "drizzle-orm";
import { getDb } from "../../../db";
import {
  approvers,
  businessPlans,
  memoSections,
  sectionQuestions,
} from "../../../db/schema";

const PLAN_ID = "2027-business-plan";

const seedSections = [
  {
    id: "executive-summary",
    title: "Executive Summary",
    requirement: "One short paragraph and 3-5 takeaways.",
  },
  {
    id: "priorities",
    title: "2027 Priorities",
    requirement: "Maximum three priorities with the decision and expected outcome.",
  },
  {
    id: "growth",
    title: "Growth Opportunities",
    requirement: "Three to five opportunities with scale, customer need, and right to win.",
  },
  {
    id: "support",
    title: "Support Needed from the Company",
    requirement: "Specific approvals, dependencies, and support required from Prologis.",
  },
  {
    id: "ai-productivity",
    title: "AI and Productivity Strategy",
    requirement: "One to two short paragraphs on AI-enabled productivity and hiring implications.",
  },
  {
    id: "headcount",
    title: "Headcount Needs",
    requirement: "Only necessary roles or capabilities with purpose and ROI rationale.",
  },
  {
    id: "risks",
    title: "Key Risks and Dependencies",
    requirement: "Three to five risks or assumptions that matter to approval.",
  },
  {
    id: "bottom-line-ask",
    title: "Bottom-Line Ask",
    requirement: "One short closing paragraph with the approval request and key takeaway.",
  },
];

type Role = "business" | "enablement" | "approver";
type Visibility = "Public" | "Draft" | "Private";
type PlanStatus = "Draft" | "Review" | "Approved";
type ApprovalPosture = "Questions" | "Approved";

type ViewerIdentity = {
  email: string;
  label: string;
};

function routeError(error: unknown) {
  const message = error instanceof Error ? error.message : "Unexpected error";

  if (message.includes("no such table")) {
    return "D1 tables are unavailable. Generate and apply the Drizzle migration before using the saved workflow.";
  }

  return message;
}

function isRole(value: string | null): value is Role {
  return value === "business" || value === "enablement" || value === "approver";
}

function isVisibility(value: unknown): value is Visibility {
  return value === "Public" || value === "Draft" || value === "Private";
}

function roleAuthor(role: Role) {
  if (role === "business") return "Business Team";
  if (role === "enablement") return "Enablement Reviewer";
  return "Approval Group";
}

function getViewerIdentity(request: Request, role: Role): ViewerIdentity {
  const email = request.headers.get("oai-authenticated-user-email")?.trim() || "";
  return {
    email,
    label: email || roleAuthor(role),
  };
}

function canDeleteComment(comment: { authorName: string; authorEmail: string | null }, viewer: ViewerIdentity) {
  return (
    comment.authorName === viewer.label ||
    (!!viewer.email && (comment.authorName === viewer.email || comment.authorEmail === viewer.email))
  );
}

function normalizePlanStatus(status: string | null | undefined): PlanStatus {
  if (status === "Review") return "Review";
  if (status === "Approved") return "Approved";
  return "Draft";
}

function normalizePosture(posture: string): ApprovalPosture {
  return posture === "Approved" ? "Approved" : "Questions";
}

function isApprovalPosture(value: string): value is ApprovalPosture {
  return value === "Questions" || value === "Approved";
}

function visibleCommentFilter(role: Role, viewer: ViewerIdentity) {
  if (role === "business") {
    // Business sees public questions and their own drafts.
    return or(
      eq(sectionQuestions.visibility, "Public"),
      and(
        eq(sectionQuestions.visibility, "Draft"),
        or(eq(sectionQuestions.authorName, viewer.label), eq(sectionQuestions.authorEmail, viewer.email)),
      ),
    );
  }

  // Enablement/Approver see public questions, private questions, and their own drafts.
  return or(
    eq(sectionQuestions.visibility, "Public"),
    eq(sectionQuestions.visibility, "Private"),
    and(
      or(eq(sectionQuestions.authorEmail, viewer.email), eq(sectionQuestions.authorName, viewer.label)),
      eq(sectionQuestions.visibility, "Draft"),
    ),
  );
}

async function ensureSeedData() {
  const db = getDb();
  const existingPlan = await db
    .select({ id: businessPlans.id })
    .from(businessPlans)
    .where(eq(businessPlans.id, PLAN_ID))
    .limit(1);

  if (existingPlan.length > 0) {
    return;
  }

  await db.insert(businessPlans).values({
    id: PLAN_ID,
    title: "2027 Business Plan",
    teamName: "",
    approvalState: "Draft",
    approvalPosture: "Drafting",
    updatedAt: new Date(),
  });

  await db.insert(memoSections).values(
    seedSections.map((section, index) => ({
      id: section.id,
      planId: PLAN_ID,
      sectionKey: section.id,
      title: section.title,
      position: index + 1,
      content: "",
      status: "Draft" as const,
      updatedAt: new Date(),
    })),
  );
}

export async function GET(request: Request) {
  try {
    await ensureSeedData();

    const url = new URL(request.url);
    const requestedRole = url.searchParams.get("role");
    const role: Role = isRole(requestedRole) ? requestedRole : "business";
    const viewer = getViewerIdentity(request, role);
    const db = getDb();

    const [plan] = await db
      .select()
      .from(businessPlans)
      .where(eq(businessPlans.id, PLAN_ID))
      .limit(1);
    const sections = await db
      .select()
      .from(memoSections)
      .where(eq(memoSections.planId, PLAN_ID))
      .orderBy(asc(memoSections.position));
    const comments = await db
      .select()
      .from(sectionQuestions)
      .where(
        and(eq(sectionQuestions.planId, PLAN_ID), visibleCommentFilter(role, viewer)),
      );
    const approvals = await db
      .select()
      .from(approvers)
      .where(eq(approvers.planId, PLAN_ID));

    return Response.json({
      plan: plan
        ? {
            ...plan,
            planStatus: normalizePlanStatus(plan.approvalState),
          }
        : plan,
      sections,
      comments: comments.map((comment) => ({
        ...comment,
        canDelete: canDeleteComment(comment, viewer),
      })),
      approvals: approvals.map((approval) => ({
        ...approval,
        posture: normalizePosture(approval.posture),
      })),
      viewer,
    });
  } catch (error) {
    return Response.json({ error: routeError(error) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await ensureSeedData();

    const db = getDb();
    const payload = (await request.json()) as Record<string, unknown>;
    const action = payload.action;
    const requestedRole = String(payload.role ?? "");
    const role: Role = isRole(requestedRole) ? requestedRole : "business";
    const viewer = getViewerIdentity(request, role);

    if (action === "save-plan") {
      const teamName = String(payload.teamName ?? "").trim();

      if (!teamName) {
        return Response.json({ error: "Team name is required" }, { status: 400 });
      }

      await db
        .update(businessPlans)
        .set({ teamName, updatedAt: new Date() })
        .where(eq(businessPlans.id, PLAN_ID));

      return Response.json({ ok: true });
    }

    if (action === "save-section") {
      const sectionId = String(payload.sectionId ?? "");
      const content = String(payload.content ?? "");
      const status = String(payload.status ?? "Draft");

      if (!["Draft", "Review", "Approved"].includes(status)) {
        return Response.json({ error: "Invalid section status" }, { status: 400 });
      }

      await db
        .update(memoSections)
        .set({ content, status: status as "Draft" | "Review" | "Approved", updatedAt: new Date() })
        .where(and(eq(memoSections.id, sectionId), eq(memoSections.planId, PLAN_ID)));

      return Response.json({ ok: true });
    }

    if (action === "create-comment") {
      const sectionId = String(payload.sectionId ?? "");
      const body = String(payload.body ?? "").trim();
      const visibility = payload.visibility;

      if (!isVisibility(visibility)) {
        return Response.json({ error: "Invalid visibility" }, { status: 400 });
      }
      if (!viewer.label || !body) {
        return Response.json({ error: "User identity and question are required" }, { status: 400 });
      }

      await db.insert(sectionQuestions).values({
        id: crypto.randomUUID(),
        planId: PLAN_ID,
        sectionId,
        authorName: viewer.label,
        authorEmail: viewer.email,
        authorRole: role === "business" ? "Business Team" : role === "enablement" ? "Enablement" : "Approver",
        body,
        visibility,
        status: "Open",
        issueType: role === "approver" ? "Approval Concern" : "Clarification",
        functionName: "",
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      return Response.json({ ok: true }, { status: 201 });
    }

    if (action === "update-comment") {
      const commentId = String(payload.commentId ?? "");
      const status = String(payload.status ?? "Open");
      const response = String(payload.response ?? "");

      if (!["Open", "Resolved"].includes(status)) {
        return Response.json({ error: "Invalid question status" }, { status: 400 });
      }

      await db
        .update(sectionQuestions)
        .set({
          status: status === "Resolved" ? "Resolved" : "Open",
          response,
          updatedAt: new Date(),
        })
        .where(eq(sectionQuestions.id, commentId));

      return Response.json({ ok: true });
    }

    if (action === "delete-comment") {
      const commentId = String(payload.commentId ?? "");

      const [comment] = await db
        .select()
        .from(sectionQuestions)
        .where(and(eq(sectionQuestions.id, commentId), eq(sectionQuestions.planId, PLAN_ID)))
        .limit(1);

      if (!comment) {
        return Response.json({ error: "Question not found" }, { status: 404 });
      }

      if (!canDeleteComment(comment, viewer)) {
        return Response.json({ error: "You do not have permission to delete this question" }, { status: 403 });
      }

      await db.delete(sectionQuestions).where(eq(sectionQuestions.id, commentId));
      return Response.json({ ok: true });
    }

    if (action === "submit-plan") {
      if (role !== "business") {
        return Response.json({ error: "Only the business team can submit the plan" }, { status: 403 });
      }

      await db
        .update(businessPlans)
        .set({ approvalState: "Review", updatedAt: new Date() })
        .where(eq(businessPlans.id, PLAN_ID));

      return Response.json({ ok: true });
    }

    if (action === "save-approval") {
      const approver = String(payload.approver ?? "").trim() || "Approver";
      const posture = String(payload.posture ?? "Questions");

      if (!isApprovalPosture(posture)) {
        return Response.json({ error: "Invalid approval posture" }, { status: 400 });
      }

      const [plan] = await db
        .select({ approvalState: businessPlans.approvalState })
        .from(businessPlans)
        .where(eq(businessPlans.id, PLAN_ID))
        .limit(1);

      if (normalizePlanStatus(plan?.approvalState) !== "Review") {
        return Response.json({ error: "Plan has not been submitted for review" }, { status: 400 });
      }

      const id = `${PLAN_ID}:plan:${approver}`;
      await db
        .insert(approvers)
        .values({
          id,
          planId: PLAN_ID,
          name: approver,
          title: "Approver",
          posture,
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: approvers.id,
          set: {
            posture,
            updatedAt: new Date(),
          },
        });

      return Response.json({ ok: true });
    }

    return Response.json({ error: "Unknown action" }, { status: 400 });
  } catch (error) {
    return Response.json({ error: routeError(error) }, { status: 500 });
  }
}
