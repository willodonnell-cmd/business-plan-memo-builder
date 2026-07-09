import { getActorFromRequest, getWorkspacePlan, toRouteErrorMessage, updatePlan } from "../../../lib/workspace-store";

function planIdFromRequest(request: Request) {
  return new URL(request.url).searchParams.get("planId");
}

export async function GET(request: Request) {
  try {
    const actor = await getActorFromRequest(request);
    return Response.json({ plan: await getWorkspacePlan(planIdFromRequest(request), actor) });
  } catch (error) {
    return Response.json({ error: toRouteErrorMessage(error) }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const actor = await getActorFromRequest(request);
    const input = await request.json();
    await updatePlan(input, actor);
    return Response.json({ plan: await getWorkspacePlan(input.planId, actor) });
  } catch (error) {
    const message = toRouteErrorMessage(error);
    return Response.json({ error: message }, { status: message.includes("authorized") ? 403 : 500 });
  }
}
