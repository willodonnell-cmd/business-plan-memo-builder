import {
  deleteQuestion,
  getWorkspacePlan,
  toRouteErrorMessage,
  updateQuestion,
} from "../../../../lib/workspace-store";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const input = await request.json();
    await updateQuestion(id, input);
    return Response.json({ plan: await getWorkspacePlan(input.planId) });
  } catch (error) {
    const message = toRouteErrorMessage(error);
    const status = message.includes("not found") ? 404 : 500;
    return Response.json({ error: message }, { status });
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const searchParams = new URL(request.url).searchParams;
    const role = searchParams.get("role") ?? undefined;
    const planId = searchParams.get("planId");
    await deleteQuestion(id, planId, role);
    return Response.json({ plan: await getWorkspacePlan(planId) });
  } catch (error) {
    const message = toRouteErrorMessage(error);
    const status = message.includes("not found") ? 404 : message.includes("Only") ? 403 : 500;
    return Response.json({ error: message }, { status });
  }
}
