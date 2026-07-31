import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import type { CovafluxClient as CovafluxClientType } from "../src/covaflux.js";

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

let CovafluxClient: typeof CovafluxClientType;

beforeAll(async () => {
  process.env.DISCORD_TOKEN = "discord-token";
  process.env.DISCORD_CLIENT_ID = "discord-client-id";
  process.env.COVAFLUX_API_BASE_URL = "http://localhost:12145";
  process.env.COVAFLUX_ADMIN_USERNAME = "admin";
  process.env.COVAFLUX_ADMIN_PASSWORD = "admin-password";
  process.env.TAILSCALE_LOGIN_SERVER = "http://headscale.example";
  process.env.DISCORD_BOT_SECRET = "test-secret-at-least-32-bytes-long";
  ({ CovafluxClient } = await import("../src/covaflux.js"));
});

afterEach(() => {
  fetchMock.mockReset();
});

function jsonResponse(body: unknown, ok = true, status = ok ? 200 : 500) {
  return {
    ok,
    status,
    json: async () => body
  };
}

describe("CovafluxClient new API methods", () => {
  it("approves and disables exit-node routes through node management endpoints", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ id: "node-1", isExitNodeApproved: true, approvedRoutes: ["0.0.0.0/0", "::/0"] }))
      .mockResolvedValueOnce(jsonResponse({ id: "node-1", isExitNodeApproved: false, approvedRoutes: [] }));

    const client = new CovafluxClient("token");
    await expect(client.approveExitNode("node-1")).resolves.toEqual(expect.objectContaining({ isExitNodeApproved: true }));
    expect(fetchMock).toHaveBeenNthCalledWith(1, "http://localhost:12145/nodes/node-1/exit-node/approve", expect.objectContaining({ method: "POST" }));

    await expect(client.disableExitNode("node-1")).resolves.toEqual(expect.objectContaining({ isExitNodeApproved: false }));
    expect(fetchMock).toHaveBeenNthCalledWith(2, "http://localhost:12145/nodes/node-1/exit-node/disable", expect.objectContaining({ method: "POST" }));
  });

  it("requests node detail from /nodes/:id", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ id: "node-1", name: "alpha", shares: [] }));

    const node = await new CovafluxClient("token").getNode("node-1");

    expect(node).toEqual({ id: "node-1", name: "alpha", shares: [] });
    expect(fetchMock).toHaveBeenCalledWith("http://localhost:12145/nodes/node-1", expect.objectContaining({
      headers: expect.any(Headers)
    }));
  });

  it("leaves an incoming share with POST /shares/:id/leave", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true, action: "revoked" }));

    await expect(new CovafluxClient("token").leaveShare("share-1")).resolves.toEqual({ ok: true, action: "revoked" });
    expect(fetchMock).toHaveBeenCalledWith("http://localhost:12145/shares/share-1/leave", expect.objectContaining({
      method: "POST"
    }));
  });

  it("changes the current user's password with PATCH /me/password", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true }));

    await expect(new CovafluxClient("token").changePassword("old-pass", "new-pass-123")).resolves.toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledWith("http://localhost:12145/me/password", expect.objectContaining({
      method: "PATCH",
      body: JSON.stringify({ currentPassword: "old-pass", newPassword: "new-pass-123" })
    }));
  });

  it("updates DERP settings through /settings/derp", async () => {
    const derpMap = { Regions: { "901": { RegionID: 901 } } };
    fetchMock.mockResolvedValueOnce(jsonResponse({ derpMap }));

    await expect(new CovafluxClient("token").updateDerpSettings(derpMap)).resolves.toEqual({ derpMap });
    expect(fetchMock).toHaveBeenCalledWith("http://localhost:12145/settings/derp", expect.objectContaining({
      method: "PUT",
      body: JSON.stringify({ derpMap })
    }));
  });
});
