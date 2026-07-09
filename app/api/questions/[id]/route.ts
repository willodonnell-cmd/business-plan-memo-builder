import {
  deleteQuestion,
  getActorFromRequest,
  getWorkspacePlan,
  toRouteErrorMessage,
  updateQuestion,
} from "../../../../lib/workspace-store";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const actor = await getActorFromRequest(request);
    const { id } = await context.params;
    const input = await request.json();
    await updateQuestion(id, input, actor);
    return Response.json({ plan: await getWorkspacePlan(input.planId, actor) });
  } catch (error) {
    const message = toRouteErrorMessage(error);
    const status = message.includes("not found") ? 404 : message.includes("cannot set") || message.includes("authorized") || message.includes("Only") ? 403 : 500;
    return Response.json({ error: message }, { status });
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const actor = await getActorFromRequest(request);
    const { id } = await context.params;
    const searchParams = new URL(request.url).searchParams;
    const planId = searchParams.get("planId");
    await deleteQuestion(id, planId, actor);
    return Response.json({ plan: await getWorkspacePlan(planId, actor) });
  } catch (error) {
    const message = toRouteErrorMessage(error);
    const status = message.includes("not found") ? 404 : message.includes("Only") || message.includes("authorized") ? 403 : 500;
    return Response.json({ error: message }, { status });
  }
}
