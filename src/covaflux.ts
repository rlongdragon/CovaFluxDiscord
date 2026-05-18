import { config } from "./config.js";

export type Actor = {
  type: "user" | "api_token";
  id: string;
  username?: string;
  role?: "admin" | "user";
};

export type CovafluxUser = {
  id: string;
  username: string;
  role?: string;
  disabledAt?: string | null;
};

export type CovafluxNode = {
  id: string;
  name: string;
  givenName?: string | null;
  ownerUserId?: string | null;
  owner?: { id: string; username: string } | null;
  ipAddresses?: string[];
  online?: boolean;
  expired?: boolean;
  lastSeenAt?: string | null;
  driftStatus?: string;
};

export type CovafluxGroup = {
  id: string;
  name: string;
  members?: Array<{ user?: CovafluxUser }>;
};

export type CovafluxShare = {
  id: string;
  node?: CovafluxNode;
  sharedBy?: CovafluxUser;
  targetUser?: CovafluxUser | null;
  targetGroup?: CovafluxGroup | null;
  allowExitNode: boolean;
  revokedAt?: string | null;
};

export class CovafluxClient {
  constructor(private readonly token?: string) {}

  async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const headers = new Headers(options.headers);
    if (this.token) headers.set("authorization", `Bearer ${this.token}`);
    if (options.body && !headers.has("content-type")) headers.set("content-type", "application/json");

    const response = await fetch(`${config.covafluxApiBaseUrl}${path}`, {
      ...options,
      headers
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message = Array.isArray(body.issues)
        ? body.issues.map((issue: { path?: string[]; message?: string }) => `${issue.path?.join(".") || "body"}: ${issue.message}`).join("; ")
        : body.message ?? body.error ?? `HTTP ${response.status}`;
      throw new Error(message);
    }
    return body as T;
  }

  async login(username: string, password: string) {
    return this.request<{ token: string }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password })
    });
  }

  async me() {
    return this.request<{ actor: Actor }>("/me");
  }

  async createUser(input: { username: string; password: string; role?: "admin" | "user" }) {
    return this.request<CovafluxUser>("/users", {
      method: "POST",
      body: JSON.stringify(input)
    });
  }

  async listUsers() {
    return this.request<CovafluxUser[]>("/users");
  }

  async listNodes() {
    return this.request<CovafluxNode[]>("/nodes");
  }

  async listShares() {
    return this.request<CovafluxShare[]>("/shares");
  }

  async syncNodes() {
    return this.request<{ count: number; staleDeleted: number }>("/nodes/sync", {
      method: "POST",
      body: JSON.stringify({})
    });
  }

  async createRegisterKey(input: {
    userId?: string;
    nodeName?: string;
    reusable?: boolean;
    ephemeral?: boolean;
    expiresInHours?: number;
  }) {
    return this.request<{ id: string; key: string; expiresAt: string }>("/nodes/register-key", {
      method: "POST",
      body: JSON.stringify(input)
    });
  }

  async expireNode(nodeId: string) {
    return this.request<{ ok: true }>(`/nodes/${nodeId}/expire`, {
      method: "POST",
      body: JSON.stringify({})
    });
  }

  async deleteNode(nodeId: string) {
    return this.request<{ ok: true }>(`/nodes/${nodeId}`, { method: "DELETE" });
  }

  async listGroups() {
    return this.request<CovafluxGroup[]>("/groups");
  }

  async createGroup(name: string) {
    return this.request<CovafluxGroup>("/groups", {
      method: "POST",
      body: JSON.stringify({ name })
    });
  }

  async addGroupMember(groupId: string, userId: string) {
    return this.request(`/groups/${groupId}/members`, {
      method: "POST",
      body: JSON.stringify({ userId })
    });
  }

  async shareNodeToUser(nodeId: string, targetUserId: string, allowExitNode: boolean) {
    return this.request<CovafluxShare>(`/nodes/${nodeId}/shares/users`, {
      method: "POST",
      body: JSON.stringify({ targetUserId, allowExitNode })
    });
  }
}

let adminToken: string | null = null;

export async function getAdminClient() {
  if (!adminToken) {
    const client = new CovafluxClient();
    const login = await client.login(config.covafluxAdminUsername, config.covafluxAdminPassword);
    adminToken = login.token;
  }
  return new CovafluxClient(adminToken);
}

export async function getUserClient(token: string) {
  return new CovafluxClient(token);
}
