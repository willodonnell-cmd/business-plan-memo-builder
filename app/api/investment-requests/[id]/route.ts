import {
  deleteInvestmentRequest,
  getActorFromRequest,
  toRouteErrorMessage,
  updateInvestmentRequest,
} from "../../../../lib/workspace-store";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const actor = await getActorFromRequest(request);
    const { id } = await context.params;
    const input = await request.json();
    const saved = await updateInvestmentRequest(id, input, actor);
    return Response.json({
      request: saved,
    });
  } catch (error) {
    const message = toRouteErrorMessage(error);
    return Response.json({ error: message }, { status: message.includes("authorized") ? 403 : 500 });
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const actor = await getActorFromRequest(request);
    const { id } = await context.params;
    const planId = new URL(request.url).searchParams.get("planId");
    await deleteInvestmentRequest(id, planId, actor);
    return Response.json({ deletedId: id });
  } catch (error) {
    const message = toRouteErrorMessage(error);
    return Response.json({ error: message }, { status: message.includes("authorized") ? 403 : 500 });
  }
}
