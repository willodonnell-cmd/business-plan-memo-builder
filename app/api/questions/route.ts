import { createQuestion, getWorkspacePlan, toRouteErrorMessage } from "../../../lib/workspace-store";

export async function POST(request: Request) {
  try {
    await createQuestion(await request.json());
    return Response.json({ plan: await getWorkspacePlan() }, { status: 201 });
  } catch (error) {
    return Response.json({ error: toRouteErrorMessage(error) }, { status: 500 });
  }
}
