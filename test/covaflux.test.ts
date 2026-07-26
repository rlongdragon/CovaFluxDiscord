import assert from "node:assert/strict";
import { before, beforeEach, test } from "node:test";
import type { CovafluxClient as CovafluxClientType } from "../src/covaflux.js";

let CovafluxClient: typeof CovafluxClientType;
let responses: unknown[] = [];
const calls: Array<{ url: string; init?: RequestInit }> = [];

before(async () => {
  process.env.DISCORD_TOKEN = "discord-token";
  process.env.DISCORD_CLIENT_ID = "discord-client-id";
  process.env.COVAFLUX_API_BASE_URL = "http://localhost:12145";
  process.env.COVAFLUX_ADMIN_USERNAME = "admin";
  process.env.COVAFLUX_ADMIN_PASSWORD = "admin-password";
  process.env.TAILSCALE_LOGIN_SERVER = "http://headscale.example";
  process.env.DISCORD_BOT_SECRET = "test-secret-at-least-32-bytes-long";
  ({ CovafluxClient } = await import("../src/covaflux.js"));
});

beforeEach(() => {
  calls.length = 0;
  responses = [];
  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init });
    return {
      ok: true,
      status: 200,
      json: async () => responses.shift()
    } as Response;
  }) as typeof fetch;
});

test("approves and disables exit-node routes through node management endpoints", async () => {
  const client = new CovafluxClient("token");
  responses.push(
    { id: "node-1", isExitNodeApproved: true, approvedRoutes: ["0.0.0.0/0", "::/0"] },
    { id: "node-1", isExitNodeApproved: false, approvedRoutes: [] }
  );

  const approved = await client.approveExitNode("node-1");
  assert.equal(approved.isExitNodeApproved, true);
  assert.equal(calls[0]?.url, "http://localhost:12145/nodes/node-1/exit-node/approve");
  assert.equal(calls[0]?.init?.method, "POST");

  const disabled = await client.disableExitNode("node-1");
  assert.equal(disabled.isExitNodeApproved, false);
  assert.equal(calls[1]?.url, "http://localhost:12145/nodes/node-1/exit-node/disable");
  assert.equal(calls[1]?.init?.method, "POST");
});
