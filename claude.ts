import { createInterface } from "node:readline/promises";
import { query } from "@anthropic-ai/claude-agent-sdk";
import { addMessage, getMessages } from "./db.js";

if (!process.env.ANTHROPIC_API_KEY) {
  console.error("set ANTHROPIC_API_KEY to run zepto-claw");
  process.exit(1);
}

export async function ask(prompt: string): Promise<string> {
  const history = getMessages()
    .map((m) => `${m.role}: ${m.content}`)
    .join("\n");
  const fullPrompt = history ? `${history}\nuser: ${prompt}` : prompt;

  let reply = "";
  for await (const event of query({ prompt: fullPrompt })) {
    if (event.type === "result" && event.subtype === "success") reply = event.result;
  }
  return reply;
}

const rl = createInterface({ input: process.stdin, output: process.stdout });
for (;;) {
  const prompt = await rl.question("you: ");
  if (!prompt.trim()) continue;
  const reply = await ask(prompt);
  addMessage("user", prompt);
  addMessage("assistant", reply);
  console.log("claw:", reply);
}
