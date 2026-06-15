import { createApprover, getWorkspacePlan, toRouteErrorMessage } from "../../../lib/workspace-store";

export async function POST(request: Request) {
  try {
    const input = await request.json();
    await createApprover({
      ...input,
      requesterEmail: request.headers.get("oai-authenticated-user-email") ?? input.requesterEmail,
    });
    return Response.json({ plan: await getWorkspacePlan() }, { status: 201 });
  } catch (error) {
    return Response.json({ error: toRouteErrorMessage(error) }, { status: 500 });
  }
}
