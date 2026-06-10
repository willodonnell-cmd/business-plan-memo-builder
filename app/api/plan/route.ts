import { and, asc, eq, inArray, or, sql } from "drizzle-orm";
import { getDb } from "../../../db";
import {
  approvalPostures,
  businessPlans,
  memoSections,
  sectionComments,
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

function visibleCommentFilter(role: Role, author: string) {
  if (role === "business") {
    return or(
      eq(sectionComments.visibility, "Public"),
      eq(sectionComments.visibility, "Private"),
      and(
        eq(sectionComments.visibility, "Draft"),
        eq(sectionComments.author, author),
      ),
    );
  }

  return or(
    eq(sectionComments.visibility, "Public"),
    and(eq(sectionComments.author, author), inArray(sectionComments.visibility, ["Draft", "Private"])),
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
    teamName: "Team",
  });

  await db.insert(memoSections).values(
    seedSections.map((section, index) => ({
      ...section,
      planId: PLAN_ID,
      position: index + 1,
    })),
  );
}

export async function GET(request: Request) {
  try {
    await ensureSeedData();

    const url = new URL(request.url);
    const requestedRole = url.searchParams.get("role");
    const role: Role = isRole(requestedRole) ? requestedRole : "business";
    const author = url.searchParams.get("author")?.trim() || "Business Team";
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
      .from(sectionComments)
      .where(
        and(eq(sectionComments.planId, PLAN_ID), visibleCommentFilter(role, author)),
      );
    const approvals = await db
      .select()
      .from(approvalPostures)
      .where(eq(approvalPostures.planId, PLAN_ID));

    return Response.json({ plan, sections, comments, approvals });
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

    if (action === "save-plan") {
      const teamName = String(payload.teamName ?? "").trim() || "Team";

      await db
        .update(businessPlans)
        .set({ teamName, updatedAt: sql`CURRENT_TIMESTAMP` })
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
        .set({ content, status: status as "Draft" | "Review" | "Approved", updatedAt: sql`CURRENT_TIMESTAMP` })
        .where(and(eq(memoSections.id, sectionId), eq(memoSections.planId, PLAN_ID)));

      return Response.json({ ok: true });
    }

    if (action === "create-comment") {
      const sectionId = String(payload.sectionId ?? "");
      const role = String(payload.role ?? "");
      const author = String(payload.author ?? "").trim();
      const body = String(payload.body ?? "").trim();
      const visibility = payload.visibility;

      if (!isRole(role)) {
        return Response.json({ error: "Invalid role" }, { status: 400 });
      }
      if (!isVisibility(visibility)) {
        return Response.json({ error: "Invalid visibility" }, { status: 400 });
      }
      if (!author || !body) {
        return Response.json({ error: "Author and question are required" }, { status: 400 });
      }

      await db.insert(sectionComments).values({
        id: crypto.randomUUID(),
        planId: PLAN_ID,
        sectionId,
        author,
        role,
        body,
        visibility,
      });

      return Response.json({ ok: true }, { status: 201 });
    }

    if (action === "update-comment") {
      const commentId = String(payload.commentId ?? "");
      const status = String(payload.status ?? "Open");
      const response = String(payload.response ?? "");

      if (!["Open", "Acknowledged", "Resolved"].includes(status)) {
        return Response.json({ error: "Invalid question status" }, { status: 400 });
      }

      await db
        .update(sectionComments)
        .set({
          status: status as "Open" | "Acknowledged" | "Resolved",
          response,
          updatedAt: sql`CURRENT_TIMESTAMP`,
        })
        .where(eq(sectionComments.id, commentId));

      return Response.json({ ok: true });
    }

    if (action === "save-approval") {
      const sectionId = String(payload.sectionId ?? "");
      const approver = String(payload.approver ?? "").trim() || "Approver";
      const posture = String(payload.posture ?? "Needs clarification");

      if (!["Needs clarification", "Ready", "Approved"].includes(posture)) {
        return Response.json({ error: "Invalid approval posture" }, { status: 400 });
      }

      const id = `${PLAN_ID}:${sectionId}:${approver}`;
      await db
        .insert(approvalPostures)
        .values({
          id,
          planId: PLAN_ID,
          sectionId,
          approver,
          posture: posture as "Needs clarification" | "Ready" | "Approved",
        })
        .onConflictDoUpdate({
          target: approvalPostures.id,
          set: {
            posture: posture as "Needs clarification" | "Ready" | "Approved",
            updatedAt: sql`CURRENT_TIMESTAMP`,
          },
        });

      return Response.json({ ok: true });
    }

    return Response.json({ error: "Unknown action" }, { status: 400 });
  } catch (error) {
    return Response.json({ error: routeError(error) }, { status: 500 });
  }
}
