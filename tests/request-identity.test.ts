import assert from "node:assert/strict";
import test from "node:test";
import { resolveActorIdentityFromRequest } from "../lib/request-identity";

test("localhost requests receive the local Business Team identity", () => {
  const identity = resolveActorIdentityFromRequest(new Request("http://localhost:3001/business-team"));

  assert.deepEqual(identity, {
    email: "local-business-team@prologis.local",
    displayName: "Local Business Team",
    isAuthenticated: true,
  });
});

test("unauthenticated hosted requests retain non-editing open access", () => {
  const identity = resolveActorIdentityFromRequest(new Request("https://business-plan.example.com/business-team"));

  assert.deepEqual(identity, {
    email: "open-access@prologis.local",
    displayName: "Open Access",
    isAuthenticated: false,
  });
});
