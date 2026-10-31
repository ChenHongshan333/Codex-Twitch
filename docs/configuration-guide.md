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

No Twitch account is needed for local simulation or local camera/OBS preview.
Leave `DODGE_LIVE=0` and skip CLI authorization for this stage. A real User Access
Token requires a Twitch account to sign in and consent; app credentials alone
are not a user account. A teammate can perform the live-channel acceptance work
on their own authorized setup while others develop in simulation.

This is development guidance. The hackathon still requires an actual Twitch
connection and footage of the project functioning on Twitch. Account-free
simulation does not finish that requirement; use the
[readiness checklist](hackathon-readiness.md) before claiming submission readiness.

Giving this backend an API token does not start a video broadcast. It receives
chat/support events and viewer counts; the tracker keeps video frames in the
browser and sends only coordinates. Publishing video is a separate encoder/OBS
action. For real-stream testing, use a test card/animation instead of a webcam
if desired; normal viewer-count acceptance still needs live channels. Twitch's
[broadcast guide](https://dev.twitch.tv/docs/video-broadcast/) describes the
separate video ingest path. CLI mock servers exist, but the current live bridge
is not configured to use their endpoints; built-in synthetic rehearsal works now.

For the current OBS dodge prototype, `npm run dodge` uses synthetic input with
`DODGE_LIVE=0`. No token, Extension credentials or public origin is needed. The
local `.env` was created from `.env.example` on 2026-10-31, with no credentials
added; it is ignored by Git. Other clones must create their own file only if absent.

For actual Twitch input in this mode, fill only these first:

```dotenv
TWITCH_OAUTH_TOKEN=your_user_access_token
DODGE_CHANNEL_A=first_channel_login
DODGE_CHANNEL_B=second_channel_login
DODGE_LIVE=1
```

Use channel login names, without `@` or a Twitch URL. Keep `DODGE_PORT=3020`.
Obtain a user token with `user:read:chat` through the private authorization steps
below; Client ID/Client Secret alone are not that token. Both streams need to be
live for the viewer-count-normalized attacks. Restart `npm run dodge` after edits;
an already running process does not reload `.env`.

`DODGE_SUPPORT_TOKEN_A`/`_B` are optional broadcaster-owned user tokens with
`bits:read` and/or `channel:read:subscriptions`; leave blank for initial chat
testing. Leave `TWITCH_EXTENSION_ID`, `TWITCH_EXTENSION_SECRET` and
`PUBLIC_ORIGIN` unset for this local OBS mode. Those settings belong to native
Extension/public-backend setup, not the minimum dodge setup. Full details:
[dodge runbook](dodge-runbook.md). The app Client ID/secret are entered privately
into the authorization tool; this backend does not read separate app credential
variables from `.env`.

The native four-role rehearsal also works without credentials:

```powershell
npm ci
npm run sandbox
```

Open `http://127.0.0.1:3010/sandbox`. This is explicit local simulation and needs
no real token/Extension secret. It does not establish real Twitch integration.
The sandbox launcher fixes loopback and disables public origin for that process.

## Obtain the user token privately

One documented route is the official [Twitch CLI](https://dev.twitch.tv/docs/cli/).
Installed on this Windows machine on 2026-10-31: `twitch-cli/1.1.24`, from the
official Windows x64 release, with its published SHA-256 checksum verified.
It is in `%LOCALAPPDATA%\Programs\TwitchCLI`, added to the user PATH. Other
teammates install their own copy. Open a new terminal for PATH changes; if the
current app still has an older environment, use the explicit path:

```powershell
& "$env:LOCALAPPDATA\Programs\TwitchCLI\twitch.exe" version
```

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

## Tokens and collaborating with teammates

A user access token is tied to the authorizing Twitch account/application and
its granted scopes. It is stored locally, but is not restricted to that computer:
someone who copies it can use its granted access elsewhere. Treat access tokens,
refresh tokens and Client Secrets like passwords, as the official
[Twitch authentication guidance](https://dev.twitch.tv/docs/authentication/) says.

Do not send your personal token, `.env` or CLI credential configuration to peers.
Teammates can use credential-free simulation or obtain their own user tokens;
each broadcaster authorizes their own support-event access. For a shared hosted
backend, use deliberately managed server credentials/OAuth consent rather than
passing personal tokens around. No token or key was generated during CLI install.
The observed Windows CLI default config is
`%APPDATA%\twitch-cli\.twitch-cli.env`; keep that file private as well.

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
