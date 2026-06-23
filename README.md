# zeptoclaw

The smallest useful AI assistant, built up one body part at a time. It chats in
your terminal and on WhatsApp, shares one memory across both, and can open a
browser, find & send your documents, push you a daily news briefing, nudge you
to drink water, keep a long-term diary, and swap which model powers it — all at
runtime.

Built on the [`@anthropic-ai/claude-agent-sdk`](https://www.npmjs.com/package/@anthropic-ai/claude-agent-sdk).

## Setup

```sh
npm install
```

Put a credential in a `.env` file (either works):

```
CLAUDE_CODE_OAUTH_TOKEN=...      # from: claude setup-token
# or
ANTHROPIC_API_KEY=sk-ant-...
```

## Run

```sh
npm start             # terminal chat (REPL)
npm run whatsapp      # WhatsApp bot — scan the QR once with Linked Devices
```

To keep a Mac awake while the bot runs:

```sh
caffeinate -dimsu npm run whatsapp
```

## Files

| File          | What it is                                                        |
| ------------- | ----------------------------------------------------------------- |
| `claude.ts`   | The brain: `ask()`, the custom tools, and the terminal REPL.      |
| `whatsapp.ts` | The mouth/ears: WhatsApp client, self-chat handling, heartbeats.  |
| `db.ts`       | SQLite — chat history, water log, and the long-term diary.        |

## What it can do

- **Chat + memory** — remembers the conversation, shared between terminal and WhatsApp.
- **Hands** — opens a browser (`open_url`), finds & sends files from `~/Documents`.
- **Heartbeat** — proactively pushes a live news briefing to your chat.
- **Hydration coach** — reminders every N hours; logs what you drink toward a daily goal. Say "stop" to cancel.
- **Diary** — saves durable facts about you (name, preferences, goals) and carries them into every chat.
- **Swappable brain** — switch the model at runtime: "switch to haiku" → opus / sonnet / haiku / fable.

## Env knobs

| Variable        | Effect                                                          |
| --------------- | -------------------------------------------------------------- |
| `ZC_MODEL`      | Default brain: `opus` (default), `sonnet`, `haiku`, `fable`.   |
| `HEARTBEAT_MS`  | News briefing interval (default 1h). Lower it to demo fast.    |
| `WATER_MS`      | Override the stated water-reminder hours (e.g. `60000` = 60s). |

## Self-checks

Each module has a built-in check (no test framework):

```sh
npx tsx db.ts                       # SQLite round-trips
npx tsx --env-file=.env whatsapp.ts --check   # reply rules + Documents boundary
```
