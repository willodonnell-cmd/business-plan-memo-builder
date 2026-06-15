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
    await updateQuestion(id, await request.json());
    return Response.json({ plan: await getWorkspacePlan() });
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
    const role = new URL(request.url).searchParams.get("role") ?? undefined;
    await deleteQuestion(id, role);
    return Response.json({ plan: await getWorkspacePlan() });
  } catch (error) {
    const message = toRouteErrorMessage(error);
    const status = message.includes("not found") ? 404 : message.includes("Only") ? 403 : 500;
    return Response.json({ error: message }, { status });
  }
}
