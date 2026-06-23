import { createQuestion, getWorkspacePlan, toRouteErrorMessage } from "../../../lib/workspace-store";

export async function POST(request: Request) {
  try {
    const input = await request.json();
    await createQuestion(input);
    return Response.json({ plan: await getWorkspacePlan(input.planId) }, { status: 201 });
  } catch (error) {
    return Response.json({ error: toRouteErrorMessage(error) }, { status: 500 });
  }
}
