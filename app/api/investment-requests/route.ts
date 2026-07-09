import {
  createInvestmentRequest,
  getActorFromRequest,
  getInvestmentRequests,
  toRouteErrorMessage,
} from "../../../lib/workspace-store";

function planIdFromRequest(request: Request) {
  return new URL(request.url).searchParams.get("planId");
}

function searchFromRequest(request: Request) {
  return new URL(request.url).searchParams.get("q");
}

export async function GET(request: Request) {
  try {
    await getActorFromRequest(request);
    return Response.json({
      requests: await getInvestmentRequests(planIdFromRequest(request), searchFromRequest(request)),
    });
  } catch (error) {
    return Response.json({ error: toRouteErrorMessage(error) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const actor = await getActorFromRequest(request);
    const input = await request.json();
    const created = await createInvestmentRequest(input, actor);
    return Response.json({
      request: created,
      requests: await getInvestmentRequests(input.planId),
    });
  } catch (error) {
    const message = toRouteErrorMessage(error);
    return Response.json({ error: message }, { status: message.includes("authorized") ? 403 : 500 });
  }
}
