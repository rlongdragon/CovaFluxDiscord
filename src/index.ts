import { randomBytes } from "node:crypto";
import {
  ChatInputCommandInteraction,
  Client,
  Events,
  GatewayIntentBits,
  Interaction,
  MessageFlags
} from "discord.js";
import { config, isDiscordAdmin } from "./config.js";
import { CovafluxClient, getAdminClient, getUserClient, type CovafluxNode, type CovafluxShare } from "./covaflux.js";
import {
  findBindingByDiscordUserId,
  findBindingByCovafluxUserId,
  getBindingJwt,
  upsertBinding,
  type Binding
} from "./store.js";

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

function randomPassword() {
  return randomBytes(18).toString("base64url").slice(0, 20);
}

function nodeLabel(node: { givenName?: string | null; name: string }) {
  return node.givenName || node.name;
}

function formatJoinCommand(key: string, exitNode: boolean) {
  const base = `sudo tailscale up --reset --login-server=${config.tailscaleLoginServer} --auth-key=${key}`;
  return exitNode ? `${base} --advertise-exit-node` : base;
}

function codeBlock(language: string, value: string) {
  return `\`\`\`${language}\n${value}\n\`\`\``;
}

function truncateDiscordMessage(value: string) {
  return value.length > 1900 ? `${value.slice(0, 1880)}\n...` : value;
}

function statusEmoji(node: { expired?: boolean; online?: boolean }) {
  if (node.expired) return "⛔ expired";
  if (node.online) return "🟢 online";
  return "⚫ offline";
}

function truncateCell(value: string, width: number) {
  if (value.length <= width) return value.padEnd(width, " ");
  return `${value.slice(0, Math.max(0, width - 1))}…`;
}

function table(headers: string[], rows: string[][]) {
  const widths = headers.map((header, index) => {
    const maxRowWidth = rows.reduce((max, row) => Math.max(max, row[index]?.length ?? 0), 0);
    return Math.min(Math.max(header.length, maxRowWidth), index === 1 ? 28 : 16);
  });
  const formatRow = (row: string[]) => row.map((cell, index) => truncateCell(cell, widths[index])).join(" | ");
  return [
    formatRow(headers),
    widths.map((width) => "-".repeat(width)).join("-+-"),
    ...rows.map(formatRow)
  ].join("\n");
}

function nodeTableRows(nodes: CovafluxNode[], type: "owned" | "shared") {
  return nodes.map((node) => {
    const ips = node.ipAddresses?.length ? node.ipAddresses.join(", ") : "-";
    return [
      type,
      nodeLabel(node),
      statusEmoji(node),
      ips,
      node.owner?.username ?? node.ownerUserId ?? "-"
    ];
  });
}

function incomingSharedNodes(shares: CovafluxShare[], currentUserId: string) {
  const seen = new Set<string>();
  const rows: string[][] = [];
  for (const share of shares) {
    if (share.revokedAt || !share.node || share.sharedBy?.id === currentUserId || seen.has(share.node.id)) continue;
    seen.add(share.node.id);
    rows.push([
      "shared",
      nodeLabel(share.node),
      "🔗 shared",
      share.node.ipAddresses?.length ? share.node.ipAddresses.join(", ") : "-",
      share.sharedBy?.username ?? share.node.owner?.username ?? share.node.ownerUserId ?? "-"
    ]);
  }
  return rows;
}

function helpMessage(isAdmin: boolean) {
  const adminLine = isAdmin
    ? "\n🛡️ 管理員：`/admin-invite user:@user` 建立並綁定使用者帳號。"
    : "";
  return [
    "📘 CovaFlux Discord Bot 使用說明",
    "",
    "先用 `/me` 檢查是否已綁定 CovaFlux 帳號。如果尚未綁定，可以使用 `/login`，或請管理員用 `/admin-invite` 建立帳號。",
    "",
    "🧩 加入節點：`/node-join name:<名稱> exit-node:<true|false>`",
    "Bot 會回傳可直接貼到機器上的 `tailscale up` 指令。",
    "",
    "🖥️ 節點管理：`/nodes-list`、`/node-expire`、`/node-delete`",
    "👥 群組管理：`/group-create`、`/group-add user:@user`",
    "🔗 分享節點：`/share-node node:<節點> user:@user allow-exit-node:<true|false>`",
    adminLine
  ].join("\n");
}

async function requireBinding(interaction: ChatInputCommandInteraction) {
  const binding = await findBindingByDiscordUserId(interaction.user.id);
  if (!binding) throw new Error("這個 Discord 帳號尚未綁定 CovaFlux。請先使用 /login，或請管理員使用 /admin-invite。");
  return binding;
}

function clientForBinding(binding: Binding) {
  return getUserClient(getBindingJwt(binding));
}

async function handleAdminInvite(interaction: ChatInputCommandInteraction) {
  if (!isDiscordAdmin(interaction.user.id)) throw new Error("只有系統管理員可以使用這個指令。");
  const target = interaction.options.getUser("user", true);
  const existing = await findBindingByDiscordUserId(target.id);
  if (existing) throw new Error(`${target.username} 已經綁定 CovaFlux 帳號 ${existing.covafluxUsername}。`);

  const admin = await getAdminClient();
  const username = target.id;
  const password = randomPassword();
  const createdUser = await admin.createUser({ username, password, role: "user" });
  const login = await new CovafluxClient().login(username, password);
  await upsertBinding({
    discordUserId: target.id,
    discordUsername: target.username,
    covafluxUserId: createdUser.id,
    covafluxUsername: createdUser.username,
    covafluxJwt: login.token,
    createdByAdminDiscordUserId: interaction.user.id
  });

  let dmStatus = "已通知目標使用者。";
  try {
    await target.send([
      "✅ 你的 CovaFlux 帳號已建立並綁定完成。",
      "",
      `CovaFlux 帳號：\`${createdUser.username}\``,
      "你可以在有安裝這台 bot 的 Discord server 使用 `/help` 查看操作方式。",
      "",
      "常用指令：",
      "`/node-join` 取得加入節點的 Tailscale 指令",
      "`/nodes-list` 查看節點",
      "`/share-node` 分享節點給其他 Discord 使用者"
    ].join("\n"));
  } catch {
    dmStatus = "但無法私訊目標使用者，可能是對方關閉了 DM。";
  }

  await interaction.editReply([
    "✅ 已建立並綁定 CovaFlux 帳號",
    "",
    `Discord：${target.username}`,
    `CovaFlux：\`${createdUser.username}\``,
    dmStatus
  ].join("\n"));
}

async function handleLogin(interaction: ChatInputCommandInteraction) {
  const username = interaction.options.getString("username", true);
  const password = interaction.options.getString("password", true);
  const login = await new CovafluxClient().login(username, password);
  const userClient = await getUserClient(login.token);
  const me = await userClient.me();
  if (me.actor.type !== "user") throw new Error("CovaFlux login did not return a user actor");

  const taken = await findBindingByCovafluxUserId(me.actor.id);
  if (taken && taken.discordUserId !== interaction.user.id) {
    throw new Error("這個 CovaFlux 帳號已經綁定到另一個 Discord 帳號。");
  }

  await upsertBinding({
    discordUserId: interaction.user.id,
    discordUsername: interaction.user.username,
    covafluxUserId: me.actor.id,
    covafluxUsername: me.actor.username ?? username,
    covafluxJwt: login.token
  });

  await interaction.editReply(`✅ 已綁定 CovaFlux 帳號：\`${me.actor.username ?? username}\``);
}

async function handleMe(interaction: ChatInputCommandInteraction) {
  const binding = await requireBinding(interaction);
  await interaction.editReply([
    "✅ 目前綁定",
    "",
    `Discord：${interaction.user.username}`,
    `CovaFlux：\`${binding.covafluxUsername}\``
  ].join("\n"));
}

async function handleNodeJoin(interaction: ChatInputCommandInteraction) {
  const binding = await requireBinding(interaction);
  const api = await clientForBinding(binding);
  const nodeName = interaction.options.getString("name") ?? undefined;
  const exitNode = interaction.options.getBoolean("exit-node") ?? false;
  const hours = interaction.options.getInteger("hours") ?? 24;
  const key = await api.createRegisterKey({
    nodeName,
    reusable: false,
    ephemeral: false,
    expiresInHours: hours
  });
  const command = formatJoinCommand(key.key, exitNode);
  await interaction.editReply([
    "🔑 已建立節點加入指令",
    "",
    `節點名稱：${nodeName ? `\`${nodeName}\`` : "未指定"}`,
    `Exit node：${exitNode ? "是" : "否"}`,
    `有效期限：${new Date(key.expiresAt).toLocaleString("zh-TW")}`,
    "",
    codeBlock("bash", command)
  ].join("\n"));
}

async function handleNodesList(interaction: ChatInputCommandInteraction) {
  const binding = await requireBinding(interaction);
  const api = await clientForBinding(binding);
  const [nodes, shares] = await Promise.all([api.listNodes(), api.listShares()]);
  const ownedRows = nodeTableRows(nodes, "owned");
  const sharedRows = incomingSharedNodes(shares, binding.covafluxUserId);
  if (ownedRows.length === 0 && sharedRows.length === 0) {
    await interaction.editReply("📭 尚未同步到任何 node。請先使用 `/node-join` 加入節點。");
    return;
  }
  const rows = [...ownedRows, ...sharedRows];
  await interaction.editReply(truncateDiscordMessage([
    `📋 Nodes (${rows.length})`,
    `🖥️ owned: ${ownedRows.length} / 🔗 shared with you: ${sharedRows.length}`,
    "",
    codeBlock("text", table(["TYPE", "NODE", "STATUS", "IP", "OWNER"], rows))
  ].join("\n")));
}

async function handleNodeExpire(interaction: ChatInputCommandInteraction) {
  const binding = await requireBinding(interaction);
  const api = await clientForBinding(binding);
  const nodeId = interaction.options.getString("node", true);
  await api.expireNode(nodeId);
  await interaction.editReply("⏸️ 已 expire node。");
}

async function handleNodeDelete(interaction: ChatInputCommandInteraction) {
  const binding = await requireBinding(interaction);
  const api = await clientForBinding(binding);
  const nodeId = interaction.options.getString("node", true);
  await api.deleteNode(nodeId);
  await interaction.editReply("🗑️ 已刪除 node。");
}

async function handleGroupCreate(interaction: ChatInputCommandInteraction) {
  const binding = await requireBinding(interaction);
  const api = await clientForBinding(binding);
  const name = interaction.options.getString("name", true);
  const group = await api.createGroup(name);
  await interaction.editReply(`👥 已建立 group：\`${group.name}\``);
}

async function handleGroupAdd(interaction: ChatInputCommandInteraction) {
  const binding = await requireBinding(interaction);
  const target = interaction.options.getUser("user", true);
  const targetBinding = await findBindingByDiscordUserId(target.id);
  if (!targetBinding) throw new Error(`${target.username} 尚未綁定 CovaFlux 帳號。`);
  const api = await clientForBinding(binding);
  const groupId = interaction.options.getString("group", true);
  await api.addGroupMember(groupId, targetBinding.covafluxUserId);
  await interaction.editReply(`✅ 已將 ${target.username} 加入 group。`);
}

async function handleShareNode(interaction: ChatInputCommandInteraction) {
  const binding = await requireBinding(interaction);
  const target = interaction.options.getUser("user", true);
  const targetBinding = await findBindingByDiscordUserId(target.id);
  if (!targetBinding) throw new Error(`${target.username} 尚未綁定 CovaFlux 帳號。`);
  const api = await clientForBinding(binding);
  const nodeId = interaction.options.getString("node", true);
  const allowExitNode = interaction.options.getBoolean("allow-exit-node") ?? false;
  await api.shareNodeToUser(nodeId, targetBinding.covafluxUserId, allowExitNode);
  await interaction.editReply(`🔗 已分享 node 給 ${target.username}${allowExitNode ? "，並允許 exit node" : ""}。`);
}

async function handleCommand(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  switch (interaction.commandName) {
    case "help":
      await interaction.editReply(helpMessage(isDiscordAdmin(interaction.user.id)));
      break;
    case "admin-invite":
      await handleAdminInvite(interaction);
      break;
    case "login":
      await handleLogin(interaction);
      break;
    case "me":
      await handleMe(interaction);
      break;
    case "node-join":
      await handleNodeJoin(interaction);
      break;
    case "nodes-list":
      await handleNodesList(interaction);
      break;
    case "node-expire":
      await handleNodeExpire(interaction);
      break;
    case "node-delete":
      await handleNodeDelete(interaction);
      break;
    case "group-create":
      await handleGroupCreate(interaction);
      break;
    case "group-add":
      await handleGroupAdd(interaction);
      break;
    case "share-node":
      await handleShareNode(interaction);
      break;
    default:
      await interaction.editReply("未知指令。");
  }
}

async function handleAutocomplete(interaction: Interaction) {
  if (!interaction.isAutocomplete()) return;
  const binding = await findBindingByDiscordUserId(interaction.user.id);
  if (!binding) {
    await interaction.respond([]);
    return;
  }
  const focused = interaction.options.getFocused(true);
  const api = await clientForBinding(binding);
  if (focused.name === "node") {
    const nodes = await api.listNodes();
    await interaction.respond(nodes.slice(0, 25).map((node) => ({
      name: `${nodeLabel(node)} ${node.online ? "(online)" : ""}`.slice(0, 100),
      value: node.id
    })));
    return;
  }
  if (focused.name === "group") {
    const groups = await api.listGroups();
    await interaction.respond(groups.slice(0, 25).map((group) => ({
      name: group.name.slice(0, 100),
      value: group.id
    })));
  }
}

client.once(Events.ClientReady, (readyClient) => {
  console.log(`Logged in as ${readyClient.user.tag}`);
});

client.on(Events.InteractionCreate, async (interaction) => {
  try {
    if (interaction.isAutocomplete()) {
      await handleAutocomplete(interaction);
      return;
    }
    if (interaction.isChatInputCommand()) await handleCommand(interaction);
  } catch (error) {
    const message = `錯誤：${(error as Error).message}`;
    if (interaction.isRepliable()) {
      if (interaction.deferred || interaction.replied) await interaction.editReply(message);
      else await interaction.reply({ content: message, flags: MessageFlags.Ephemeral });
    }
  }
});

await client.login(config.discordToken);
