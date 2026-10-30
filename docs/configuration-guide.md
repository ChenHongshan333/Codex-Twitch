# Twitch configuration, starting with your Client ID and Client Secret

Checked against the current implementation and official Twitch documentation on
2026-10-31. The two credentials under Developer Console **Applications** identify
your OAuth application. They are not sufficient by themselves to run a native
Extension. Do not paste their values into chat or shared records.

## Which value is which?

| Value | Where it comes from | What this project does with it |
| --- | --- | --- |
| Application Client ID | Your registered Twitch application | The backend derives it from user-token validation; no separate `.env` entry is currently read |
| Application Client Secret | That application's private settings | Used privately by a token-authorization tool/flow; the current backend does not read a `TWITCH_CLIENT_SECRET` variable |
| `TWITCH_OAUTH_TOKEN` | User authorizes that app, producing a **User Access Token** | Channel lookup and EventSub chat; never substitute Client Secret or an app-only token |
| `TWITCH_EXTENSION_ID` | Developer Console **Extensions**, after creating/selecting your Extension | Identifies the native Extension and its allowed CDN origin |
| `TWITCH_EXTENSION_SECRET` | That Extension's shared-secret settings | Original Base64 shared secret used to validate Helper JWTs; not your application's Client Secret |
| `PUBLIC_ORIGIN` | The actual HTTPS address of the deployed backend | Both streamers' Extension package and server agree on this address |

Sources: [OAuth flows](https://dev.twitch.tv/docs/authentication/getting-tokens-oauth/),
[chat authentication](https://dev.twitch.tv/docs/chat/authenticating/),
[Extension identity/shared-secret background](https://dev.twitch.tv/docs/extensions/required-technical-background/).
The app-variable behavior in the table is from `server.mjs`, `src/twitch.mjs`,
and `src/twitch-directory.mjs`, not an additional Twitch platform rule.

## Start locally without any credentials

```powershell
npm ci
npm run sandbox
```

Open `http://127.0.0.1:3010/sandbox`. This is explicit local simulation and needs
no real token/Extension secret. It does not establish real Twitch integration.
The sandbox launcher fixes loopback and disables public origin for that process.

## Obtain the user token privately

One documented route is the official [Twitch CLI](https://dev.twitch.tv/docs/cli/),
which was not installed/on PATH when checked in this session.

1. Install the CLI using its official Windows/manual instructions. In your
   application's OAuth redirect settings include `http://localhost:3000`, as
   required by the CLI's [user-token command](https://dev.twitch.tv/docs/cli/token-command/).
   Stop any project process using port 3000 before the CLI's callback runs.
2. Run the following in your own private terminal. The CLI prompts for app
   credentials if it has not been configured; enter them there. Log into the
   intended Twitch account in the consent browser it opens.

```powershell
twitch token --user-token --scopes "user:read:chat user:write:chat"
```

3. The terminal displays a **User Access Token** and may show a refresh token.
   Copy only the access-token value into `TWITCH_OAUTH_TOKEN` in local `.env`.
   Do not copy the output into chat, screenshots, Git, or Google Docs. Current
   backend code does not implement refresh-token renewal.

`user:read:chat` is the existing code's required reading scope;
`user:write:chat` allows replies. The generic Example Chatbot sample also lists
`user:bot`; do not mix that example's list with the separate App Access Token/
cloud-bot authorization model. Confirm actual two-channel subscriptions with
the existing verifier once privately configured.

Create `.env` from `.env.example` only when it is absent. Preserve an existing
file. There is no need to add an unsupported app Client Secret variable.

## Other settings you can leave at defaults

| Setting | Local/default | When to change |
| --- | --- | --- |
| `PORT` | `3000` | Another process uses it, or your host supplies a port |
| `HOST` | `127.0.0.1` | Docker/cloud service normally uses `0.0.0.0` |
| `SANDBOX_PORT` | `3010` | Only for the separate local simulator |
| `ENABLE_SANDBOX` | `0` | Keep 0 publicly; use `npm run sandbox` for simulation |
| `ENABLE_DEBUG` | Local debug enabled unless 0; public origin disables it by default | Set 0 explicitly on public deployments |
| `ADMIN_KEY` | Optional, generated on startup | Only a stable local legacy-debug session; native PK does not use it |
| `EXTENSION_ALLOWED_ORIGINS` | Empty | Only additional exact development frontend origins; Twitch's own Extension CDN origin is automatic |
| `PUBLIC_ORIGIN` | Unset locally | Set the actual HTTPS backend origin for remote Twitch use; it is not your Twitch channel URL |

Next follow [Extension setup](twitch-extension-setup.md) for ID/shared secret,
allowlists, installation, identity linking, and the ZIP; use
[deployment instructions](cloud-deploy.md) to obtain the real backend origin.
Run `npm run doctor:extension` for names/status only, then a local read-only chat
check with `npm run verify:twitch -- <channelA> <channelB>` when ready.

## Submission access decision

The [hackathon FAQ](https://twitchcon-codex.devpost.com/resources) says judges cannot
install an unreviewed Extension and estimates 5–14 days for review. An allowlisted
Hosted Test helps your team test but is not proof of judge access. Resolve that
release decision before relying solely on the native Extension for submission.
This guide does not automatically change the native product direction.
