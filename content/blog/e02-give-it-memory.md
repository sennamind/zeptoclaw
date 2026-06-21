# My AI agent had amnesia. I fixed it with one file.

Last episode we built zepto-claw: a 30-line agent you can talk to.

It had one cruel flaw. Every time you restart it, it forgets you exist. Tell it your name, quit, come back — total stranger.

A goldfish with a college degree.

Today we fix that. And the fix is smaller than you think: **one file, one table, and a SQLite database that ships with Node itself.** No new dependency. No setup. No server.

## The one idea

Memory is just: **write down what was said, read it back next time.**

Before the model answers, we paste the whole past conversation in front of your new message. That's it. The model isn't "remembering" — we're just reminding it, every single turn.

## The whole memory

This is `db.ts`. Node 22 has a SQLite database built in (`node:sqlite`), so there's nothing to install.

```ts
import { DatabaseSync } from "node:sqlite";

const db = new DatabaseSync("zeptoclaw.db");
db.exec("CREATE TABLE IF NOT EXISTS messages (role TEXT, content TEXT)");

const insert = db.prepare("INSERT INTO messages (role, content) VALUES (?, ?)");
const selectAll = db.prepare("SELECT role, content FROM messages ORDER BY rowid");

export function addMessage(role: string, content: string) {
  insert.run(role, content);
}

export function getMessages(): { role: string; content: string }[] {
  return selectAll.all() as { role: string; content: string }[];
}
```

Two functions. `addMessage` saves a line. `getMessages` reads every line back, in order. The database is a single file on disk (`zeptoclaw.db`), so it survives restarts for free.

## Wire it into the brain

Now the loop remembers. Before asking, we load history and stick it in front of the new message. After answering, we save both sides.

```ts
export async function ask(prompt: string): Promise<string> {
  const history = getMessages().map((m) => `${m.role}: ${m.content}`).join("\n");
  const fullPrompt = history ? `${history}\nuser: ${prompt}` : prompt;
  // ...send fullPrompt to the model, return the reply...
}

// in the loop, after each reply:
addMessage("user", prompt);
addMessage("assistant", reply);
```

Notice the order: we read history *before* saving the new message, so the model never sees the question twice. Then we save both lines for next time.

## Prove it remembers

```bash
npx tsx claude.ts
you: my name is Senna
claw: Nice to meet you, Senna!
# quit with Ctrl+C, then start it again
npx tsx claude.ts
you: what's my name?
claw: Your name is Senna.
```

It came back from a full restart and still knew. That's the whole point.

## How do I know the database actually works?

`db.ts` has a tiny built-in check. Run the file directly and it writes two rows, reads them back, and shouts if anything is wrong:

```bash
npx tsx db.ts
# db self-check OK: 2 messages total
```

Run it twice — the count grows. That's persistence you can see.

## The happy ending (and the next catch)

zepto-claw now has a memory that survives restarts, in one tiny file, with zero dependencies.

But there's still a wall: it only lives in your terminal. You can't text it from your phone. You can't reach it from the couch.

**Next episode: we give it a mouth — and put it on WhatsApp.**
