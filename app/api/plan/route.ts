import { getWorkspacePlan, toRouteErrorMessage, updatePlan } from "../../../lib/workspace-store";

function planIdFromRequest(request: Request) {
  return new URL(request.url).searchParams.get("planId");
}

export async function GET(request: Request) {
  try {
    return Response.json({ plan: await getWorkspacePlan(planIdFromRequest(request)) });
  } catch (error) {
    return Response.json({ error: toRouteErrorMessage(error) }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const input = await request.json();
    await updatePlan(input);
    return Response.json({ plan: await getWorkspacePlan(input.planId) });
  } catch (error) {
    return Response.json({ error: toRouteErrorMessage(error) }, { status: 500 });
  }
}
