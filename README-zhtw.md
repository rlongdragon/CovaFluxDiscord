# CovaFlux Discord Bot

[English](README.md) | [中文](README-zhtw.md)

CovaFlux Discord Bot 是一個 Discord slash-command 機器人，用來操作 CovaFlux 帳號、節點、群組與節點分享。

## 功能

這台 bot 讓 Discord 使用者不需要開啟 web panel，也能操作 CovaFlux。一個 Discord 帳號可以綁定一個 CovaFlux 帳號。綁定後，使用者可以建立 Tailscale/Headscale 節點加入指令、查看與管理節點、建立群組、把 Discord 使用者加入群組，以及分享節點給其他 Discord 使用者。

Bot 只透過 CovaFlux API 操作，不會直接寫入 CovaFlux database。

## 設定

```bash
npm install
cp .env.example .env
```

填寫 `.env`：

```env
DISCORD_TOKEN=
DISCORD_CLIENT_ID=
DISCORD_ADMIN_USER_IDS=123456789012345678

# 可選。留空時會註冊全域指令，bot 加入的所有 server 都能使用。
DISCORD_GUILD_ID=

COVAFLUX_API_BASE_URL=http://localhost:12145
COVAFLUX_ADMIN_USERNAME=admin
COVAFLUX_ADMIN_PASSWORD=<your-covaflux-admin-password>
TAILSCALE_LOGIN_SERVER=http://your-headscale-login-server

DISCORD_BOT_SECRET=<use-a-long-random-secret>
DATA_DIR=./data
```

`DISCORD_ADMIN_USER_IDS` 是可以執行 `/admin-invite` 的 Discord user ID 清單，多個 ID 用逗號分隔。

`DISCORD_GUILD_ID` 是可選設定。留空時，bot 不會限制在單一 Discord server。全域指令在 Discord 更新時可能需要比較久才會出現。

`DISCORD_BOT_SECRET` 會用來加密儲存在 `data/bindings.json` 裡面的 CovaFlux JWT。使用者綁定後不要更換這個值，除非你準備讓所有使用者重新登入或重新邀請。

## 指令註冊與啟動

註冊 slash commands：

```bash
npm run register
```

開發模式啟動：

```bash
npm run dev
```

編譯後啟動：

```bash
npm run build
npm start
```

用 PM2 執行：

```bash
npm run build
npm run pm2:start
npm run pm2:status
```

## 支援的 Slash Commands

- `/help` 在 Discord 內顯示使用說明。
- `/admin-invite user:@user` 建立並綁定目標 Discord 使用者的 CovaFlux 帳號。CovaFlux username 會使用目標使用者的 Discord user ID。Bot 會產生 20 位隨機密碼、登入一次並加密保存 JWT；密碼不會顯示。
- `/login username password` 將目前 Discord 帳號綁定到既有 CovaFlux 帳號。
- `/me` 查看目前綁定狀態。
- `/node-join name exit-node hours` 建立 Headscale/Tailscale pre-auth key，並回傳 `tailscale up` 指令。
- `/nodes-list` 列出目前 CovaFlux 使用者可見的節點。
- `/node-expire node` expire 一個節點。
- `/node-delete node` 刪除一個節點。
- `/group-create name` 建立 CovaFlux group。
- `/group-add group user:@user` 將已綁定的 Discord 使用者加入 group。
- `/share-node node user:@user allow-exit-node` 分享節點給已綁定的 Discord 使用者。
- `/unshare-node node user:@user` 撤銷已分享給 Discord 使用者的節點。

所有回覆都是 ephemeral，只有執行指令的使用者看得到。

## 使用者流程

在 Discord 先執行 `/help`。Bot 會顯示可用功能與常見流程。

如果管理員已經邀請你，你的 Discord 帳號會自動綁定 CovaFlux 帳號。可以用 `/me` 確認。

如果你已經有 CovaFlux 帳號，執行：

```text
/login username:<your-covaflux-username> password:<your-covaflux-password>
```

要把一台機器加入 Headscale/Tailscale，執行：

```text
/node-join name:<optional-node-name> exit-node:false
```

Bot 會回傳類似這樣的指令：

```bash
sudo tailscale up --reset --login-server=<server> --auth-key=<key>
```

在要加入的機器上執行該指令即可。如果要讓該機器宣告成 exit node，將 `exit-node` 設成 `true`。

查看與管理節點：

```text
/nodes-list
/node-expire node:<choose-from-autocomplete>
/node-delete node:<choose-from-autocomplete>
```

分享節點給其他 Discord 使用者前，對方必須已經透過 `/admin-invite` 或 `/login` 綁定。接著執行：

```text
/share-node node:<choose-node> user:@target allow-exit-node:false
/unshare-node node:<choose-node> user:@target
```

管理群組：

```text
/group-create name:<group-name>
/group-add group:<choose-group> user:@target
```

## 管理員流程

先在 `DISCORD_ADMIN_USER_IDS` 設定 Discord 管理員 user ID。

管理員可以建立並綁定帳號：

```text
/admin-invite user:@target
```

建立出來的 CovaFlux username 會是目標使用者的 Discord user ID。Bot 會產生 20 位隨機密碼、登入一次並保存加密後的 CovaFlux JWT，但不會顯示密碼。帳號建立後，bot 會私訊通知目標使用者帳號已準備完成，並請對方使用 `/help` 查看操作方式。

如果目標使用者關閉 DM 或封鎖私訊，指令仍會成功，但 bot 會回報無法送出通知。
