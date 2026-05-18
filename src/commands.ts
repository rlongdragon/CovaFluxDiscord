import { REST, Routes, SlashCommandBuilder } from "discord.js";
import { config } from "./config.js";

export const commands = [
  new SlashCommandBuilder()
    .setName("help")
    .setDescription("Show how to use this CovaFlux bot"),
  new SlashCommandBuilder()
    .setName("admin-invite")
    .setDescription("Create and bind a CovaFlux account for a Discord user")
    .addUserOption((option) => option.setName("user").setDescription("Discord user").setRequired(true)),
  new SlashCommandBuilder()
    .setName("login")
    .setDescription("Bind your Discord account to an existing CovaFlux account")
    .addStringOption((option) => option.setName("username").setDescription("CovaFlux username").setRequired(true))
    .addStringOption((option) => option.setName("password").setDescription("CovaFlux password").setRequired(true)),
  new SlashCommandBuilder()
    .setName("me")
    .setDescription("Show your CovaFlux binding"),
  new SlashCommandBuilder()
    .setName("node-join")
    .setDescription("Create a Tailscale join command for a new node")
    .addStringOption((option) => option.setName("name").setDescription("Optional node name").setRequired(false))
    .addBooleanOption((option) => option.setName("exit-node").setDescription("Advertise this node as an exit node").setRequired(false))
    .addIntegerOption((option) => option.setName("hours").setDescription("Key lifetime in hours, max 720").setRequired(false).setMinValue(1).setMaxValue(720)),
  new SlashCommandBuilder()
    .setName("nodes-list")
    .setDescription("List your CovaFlux nodes"),
  new SlashCommandBuilder()
    .setName("node-expire")
    .setDescription("Expire one of your CovaFlux nodes")
    .addStringOption((option) => option.setName("node").setDescription("Node").setRequired(true).setAutocomplete(true)),
  new SlashCommandBuilder()
    .setName("node-delete")
    .setDescription("Delete one of your CovaFlux nodes")
    .addStringOption((option) => option.setName("node").setDescription("Node").setRequired(true).setAutocomplete(true)),
  new SlashCommandBuilder()
    .setName("group-create")
    .setDescription("Create a CovaFlux group")
    .addStringOption((option) => option.setName("name").setDescription("Group name").setRequired(true)),
  new SlashCommandBuilder()
    .setName("group-add")
    .setDescription("Add a Discord user to one of your CovaFlux groups")
    .addStringOption((option) => option.setName("group").setDescription("Group").setRequired(true).setAutocomplete(true))
    .addUserOption((option) => option.setName("user").setDescription("Discord user").setRequired(true)),
  new SlashCommandBuilder()
    .setName("share-node")
    .setDescription("Share one of your nodes with a Discord user")
    .addStringOption((option) => option.setName("node").setDescription("Node").setRequired(true).setAutocomplete(true))
    .addUserOption((option) => option.setName("user").setDescription("Discord user").setRequired(true))
    .addBooleanOption((option) => option.setName("allow-exit-node").setDescription("Allow exit-node access").setRequired(false))
].map((command) => command.toJSON());

export async function registerCommands() {
  const rest = new REST({ version: "10" }).setToken(config.discordToken);
  const route = config.discordGuildId
    ? Routes.applicationGuildCommands(config.discordClientId, config.discordGuildId)
    : Routes.applicationCommands(config.discordClientId);
  await rest.put(route, { body: commands });
}
