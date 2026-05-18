import "dotenv/config";
import path from "node:path";

function required(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function optional(name: string, fallback: string) {
  const value = process.env[name]?.trim();
  return value || fallback;
}

export const config = {
  discordToken: required("DISCORD_TOKEN"),
  discordClientId: required("DISCORD_CLIENT_ID"),
  discordGuildId: process.env.DISCORD_GUILD_ID?.trim(),
  discordAdminUserIds: new Set(
    optional("DISCORD_ADMIN_USER_IDS", "")
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean)
  ),
  covafluxApiBaseUrl: optional("COVAFLUX_API_BASE_URL", "http://localhost:12145").replace(/\/$/, ""),
  covafluxAdminUsername: required("COVAFLUX_ADMIN_USERNAME"),
  covafluxAdminPassword: required("COVAFLUX_ADMIN_PASSWORD"),
  tailscaleLoginServer: required("TAILSCALE_LOGIN_SERVER").replace(/\/$/, ""),
  botSecret: required("DISCORD_BOT_SECRET"),
  dataDir: path.resolve(optional("DATA_DIR", "./data"))
};

export function isDiscordAdmin(userId: string) {
  return config.discordAdminUserIds.has(userId);
}
