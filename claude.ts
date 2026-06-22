import { createInterface } from "node:readline/promises";
import { query } from "@anthropic-ai/claude-agent-sdk";
import { addMessage, getMessages } from "./db.js";

if (!process.env.ANTHROPIC_API_KEY && !process.env.CLAUDE_CODE_OAUTH_TOKEN) {
  console.error("set ANTHROPIC_API_KEY or CLAUDE_CODE_OAUTH_TOKEN to run zepto-claw");
  process.exit(1);
}

export async function ask(prompt: string): Promise<string> {
  const history = getMessages()
    .map((m) => `${m.role}: ${m.content}`)
    .join("\n");
  const fullPrompt = history ? `${history}\nuser: ${prompt}` : prompt;

  let reply: string | undefined;
  // settingSources:[] isolates the claw from this machine's Claude Code setup
  // (CLAUDE.md, hooks, the ponytail persona) so it answers as a plain assistant,
  // not as a dev tool. systemPrompt replaces the default coding-agent prompt.
  for await (const event of query({
    prompt: fullPrompt,
    options: {
      settingSources: [],
      systemPrompt: "You are zepto-claw, a friendly, concise assistant chatting over WhatsApp. Answer directly. No coding-tool chatter.",
    },
  })) {
    if (event.type === "result" && event.subtype === "success") reply = event.result;
  }
  if (reply === undefined) throw new Error("no reply from model");
  return reply;
}

// Terminal REPL — only when this file is the entry point, so other mouths
// (whatsapp.ts) can import ask() without starting the readline loop.
if (import.meta.url === `file://${process.argv[1]}`) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  for (;;) {
    const prompt = await rl.question("you: ");
    if (!prompt.trim()) continue;
    try {
      const reply = await ask(prompt);
      addMessage("user", prompt);
      addMessage("assistant", reply);
      console.log("claw:", reply);
    } catch (err) {
      console.error("error:", err instanceof Error ? err.message : err);
    }
  }
}
