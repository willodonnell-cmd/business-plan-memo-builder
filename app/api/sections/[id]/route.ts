import { getActorFromRequest, getWorkspacePlan, toRouteErrorMessage, updateSection } from "../../../../lib/workspace-store";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const actor = await getActorFromRequest(request);
    const { id } = await context.params;
    const input = await request.json();
    await updateSection(id, input, actor);
    return Response.json({ plan: await getWorkspacePlan(input.planId, actor) });
  } catch (error) {
    const message = toRouteErrorMessage(error);
    const status = message.includes("not found") ? 404 : message.includes("authorized") ? 403 : 500;
    return Response.json({ error: message }, { status });
  }
}
