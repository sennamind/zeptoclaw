import { createInterface } from "node:readline/promises";
import { query } from "@anthropic-ai/claude-agent-sdk";

if (!process.env.ANTHROPIC_API_KEY) {
  console.error("set ANTHROPIC_API_KEY to run zepto-claw");
  process.exit(1);
}

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
