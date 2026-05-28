# CovaFlux Discord Bot

[English](README.md) | [中文](README-zhtw.md)

Discord slash-command bot for operating CovaFlux accounts, nodes, groups, and node sharing.

## What This Bot Does

This bot lets Discord users operate CovaFlux without opening the web panel. A Discord account can be bound to one CovaFlux account. After binding, users can create Tailscale/Headscale node join commands, list and manage nodes, create groups, add Discord users to groups, and share nodes with other Discord users.

The bot uses CovaFlux APIs only. It does not write directly to the CovaFlux database.

## Setup

```bash
npm install
cp .env.example .env
```

Fill `.env`:

```env
DISCORD_TOKEN=
DISCORD_CLIENT_ID=
DISCORD_ADMIN_USER_IDS=123456789012345678

# Optional. Leave empty for global commands across every server where the bot is installed.
DISCORD_GUILD_ID=

COVAFLUX_API_BASE_URL=http://localhost:12145
COVAFLUX_ADMIN_USERNAME=admin
COVAFLUX_ADMIN_PASSWORD=<your-covaflux-admin-password>
TAILSCALE_LOGIN_SERVER=http://your-headscale-login-server

DISCORD_BOT_SECRET=<use-a-long-random-secret>
DATA_DIR=./data
```

`DISCORD_ADMIN_USER_IDS` is a comma-separated list of Discord user IDs allowed to run `/admin-invite`.

`DISCORD_GUILD_ID` is optional. Leave it empty if the bot should not be limited to one Discord server. Global command updates can take longer to appear in Discord than guild-scoped commands.

`DISCORD_BOT_SECRET` encrypts stored CovaFlux JWTs in `data/bindings.json`. Do not change it after users are bound unless you are ready to re-login/re-invite users.

## Commands

Register slash commands:

```bash
npm run register
```

Run in development:

```bash
npm run dev
```

Build and run compiled JS:

```bash
npm run build
npm start
```

Run with PM2:

```bash
npm run build
npm run pm2:start
npm run pm2:status
```

## Supported Slash Commands

- `/help` shows the user-facing guide inside Discord.
- `/admin-invite user:@user` creates a CovaFlux user named with the target Discord user ID, generates a 20-character random password, logs in once, stores the encrypted JWT, and binds the Discord account. The password is not shown.
- `/login username password` binds an existing CovaFlux account to the current Discord account.
- `/me` shows the current binding.
- `/node-join name exit-node hours` creates a Headscale/Tailscale pre-auth key and returns a `tailscale up` command.
- `/nodes-list` lists nodes visible to the bound CovaFlux user.
- `/node-expire node` expires a node.
- `/node-delete node` deletes a node.
- `/group-create name` creates a CovaFlux group owned by the bound user.
- `/group-add group user:@user` adds a bound Discord user to a group.
- `/share-node node user:@user allow-exit-node` shares a node with a bound Discord user.
- `/unshare-node node user:@user` revokes a node share from a bound Discord user.

All replies are ephemeral.

## User Guide

Start with `/help` in Discord. The bot will show the available actions and the usual flow.

If an admin already invited you, your Discord account is already bound to a CovaFlux account. Use `/me` to confirm the binding.

If you already have a CovaFlux account, run:

```text
/login username:<your-covaflux-username> password:<your-covaflux-password>
```

To add a machine to Headscale/Tailscale, run:

```text
/node-join name:<optional-node-name> exit-node:false
```

The bot returns a command like:

```bash
sudo tailscale up --reset --login-server=<server> --auth-key=<key>
```

Run that command on the machine you want to add. To advertise an exit node, set `exit-node:true`.

To inspect and manage nodes:

```text
/nodes-list
/node-expire node:<choose-from-autocomplete>
/node-delete node:<choose-from-autocomplete>
```

To share access with another Discord user, that user must already be bound through `/admin-invite` or `/login`. Then run:

```text
/share-node node:<choose-node> user:@target allow-exit-node:false
/unshare-node node:<choose-node> user:@target
```

To manage groups:

```text
/group-create name:<group-name>
/group-add group:<choose-group> user:@target
```

## Admin Flow

Set Discord admin user IDs in `DISCORD_ADMIN_USER_IDS`.

Admins can create and bind accounts:

```text
/admin-invite user:@target
```

The created CovaFlux username is the target user's Discord user ID. The bot generates a 20-character random password, logs in once to store an encrypted CovaFlux JWT, and does not show the password. After the account is created, the bot sends a DM to the target user explaining that their account is ready and pointing them to `/help`.

If the target user blocks DMs or disables server DMs, the command still succeeds but reports that the DM could not be delivered.
