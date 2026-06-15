import { getWorkspacePlan, toRouteErrorMessage, updatePlan } from "../../../lib/workspace-store";

export async function GET() {
  try {
    return Response.json({ plan: await getWorkspacePlan() });
  } catch (error) {
    return Response.json({ error: toRouteErrorMessage(error) }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    await updatePlan(await request.json());
    return Response.json({ plan: await getWorkspacePlan() });
  } catch (error) {
    return Response.json({ error: toRouteErrorMessage(error) }, { status: 500 });
  }
}
