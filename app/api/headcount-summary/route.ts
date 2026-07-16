import {
  generateHeadcountNeedsPreview,
  getActorFromRequest,
  getHeadcountSummaryReadiness,
  getWorkspacePlan,
  replaceHeadcountNeedsWithSummary,
  toRouteErrorMessage,
} from "../../../lib/workspace-store";

export async function GET(request: Request) {
  try {
    const actor = await getActorFromRequest(request);
    const planId = new URL(request.url).searchParams.get("planId");
    return Response.json(await getHeadcountSummaryReadiness(planId, actor));
  } catch (error) {
    const message = toRouteErrorMessage(error);
    return Response.json({ error: message }, { status: message.includes("authorized") ? 403 : 500 });
  }
}

export async function POST(request: Request) {
  try {
    const actor = await getActorFromRequest(request);
    const input = await request.json() as { planId?: string; action?: "preview" | "replace"; summary?: string };
    if (input.action === "replace") {
      await replaceHeadcountNeedsWithSummary(input.planId, input.summary ?? "", actor);
      return Response.json({ plan: await getWorkspacePlan(input.planId, actor) });
    }
    return Response.json({ preview: await generateHeadcountNeedsPreview(input.planId, actor) });
  } catch (error) {
    const message = toRouteErrorMessage(error);
    return Response.json({ error: message }, { status: message.includes("authorized") ? 403 : 500 });
  }
}
