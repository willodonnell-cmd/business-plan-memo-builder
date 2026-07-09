import { createSection, getActorFromRequest, getWorkspacePlan, toRouteErrorMessage } from "../../../lib/workspace-store";

export async function POST(request: Request) {
  try {
    const actor = await getActorFromRequest(request);
    const input = await request.json();
    await createSection(input, actor);
    return Response.json({ plan: await getWorkspacePlan(input.planId, actor) }, { status: 201 });
  } catch (error) {
    const message = toRouteErrorMessage(error);
    const status = message.includes("authorized") ? 403 : message.includes("required") ? 400 : 500;
    return Response.json({ error: message }, { status });
  }
}
