# I built an AI agent in 30 lines. Here's the whole thing.

Everyone makes AI agents sound hard.

Frameworks. Vector databases. Orchestration layers. Diagrams with twelve boxes.

Here's the secret nobody says out loud: an agent is just **a prompt going in and an answer coming out.** That's it. Everything else is decoration you add later, only when you actually need it.

So let's build the smallest one that works. I call it **zepto-claw** — the tiniest version of a claw machine for AI. By the end of this post you'll have a thing you can talk to in your terminal.

## The one idea

An agent does three things in a loop:

1. You type something.
2. It asks the model.
3. It prints the answer.

Then it does it again. That loop *is* the agent.

## The whole brain

This is `claude.ts`. Read it — it's shorter than the explanation it deserves.

```ts
import { createInterface } from "node:readline/promises";
import { query } from "@anthropic-ai/claude-agent-sdk";

export async function ask(prompt: string): Promise<string> {
  let reply = "";
  for await (const event of query({ prompt })) {
    if (event.type === "result" && event.subtype === "success") reply = event.result;
  }
  return reply;
}

const rl = createInterface({ input: process.stdin, output: process.stdout });
for (;;) {
  const prompt = await rl.question("you: ");
  if (!prompt.trim()) continue;
  console.log("claw:", await ask(prompt));
}
```

That's the agent. `ask()` sends your text to the model and pulls out the reply. The loop at the bottom reads a line, prints the answer, repeats forever.

## How it actually works

The SDK's `query()` doesn't hand you one neat string. It *streams* — it sends a series of events as the model thinks. We don't care about most of them. We wait for the one that says "I'm done and it worked" (`result` + `success`) and grab its text.

That's the only trick in the file. The rest is a `readline` loop you'd write for any command-line tool.

## Run it

```bash
npm install
export ANTHROPIC_API_KEY=sk-...   # without this it stops and tells you so
npx tsx claude.ts
```

Type a message. Get a reply. You're talking to your own agent.

## The happy ending (and the catch)

Thirty lines. No framework. No database. A real working agent.

But try this: tell it your name. Then quit and start it again. Ask "what's my name?"

It has no idea. Every restart, it forgets everything. Right now zepto-claw is a brain in a jar with no memory.

**Next episode: we give it one.**
