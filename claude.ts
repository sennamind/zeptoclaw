import { createInterface } from "node:readline/promises";
import { execFile } from "node:child_process";
import { realpathSync } from "node:fs";
import { homedir } from "node:os";
import { join, sep } from "node:path";
import { query, createSdkMcpServer, tool } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";
import { addMessage, getMessages } from "./db.js";

if (!process.env.ANTHROPIC_API_KEY && !process.env.CLAUDE_CODE_OAUTH_TOKEN) {
  console.error("set ANTHROPIC_API_KEY or CLAUDE_CODE_OAUTH_TOKEN to run zepto-claw");
  process.exit(1);
}

const DOCS = join(homedir(), "Documents");

// A file is sendable only if it really lives inside Documents — checked on the
// realpath so `../` and symlinks can't escape the folder (no texting it your
// ssh keys). Caller resolves the path first; this is the pure prefix test.
export function isInsideDocs(resolvedPath: string, docs = DOCS): boolean {
  return resolvedPath.startsWith(docs + sep);
}

// Whoever's driving the chat wires this up: WhatsApp attaches the real file,
// the terminal has none so it stays null. ponytail: one global sender — a
// single chat at a time, fine for a demo; key it by chat to serve many at once.
let fileSender: ((path: string) => Promise<string>) | null = null;
export function onSendFile(fn: ((path: string) => Promise<string>) | null) {
  fileSender = fn;
}

// The claw's hands: open a browser, search Documents, hand a file back.
const claw = createSdkMcpServer({
  name: "claw",
  version: "1.0.0",
  tools: [
    // Open a real browser window. Model builds the URL (search, video, maps).
    // execFile (no shell) + http(s)-only so texted input can't run commands.
    tool(
      "open_url",
      "Open a URL in the user's web browser on their screen. Build the full https URL yourself — a YouTube search/watch URL, a Google Maps directions URL, or any site.",
      { url: z.string().describe("full https:// URL to open") },
      async ({ url }) => {
        if (!/^https?:\/\//i.test(url)) return { content: [{ type: "text", text: "refused: not an http(s) url" }] };
        execFile("open", [url]);
        return { content: [{ type: "text", text: `opened ${url}` }] };
      },
    ),
    // Search Documents: Spotlight first (matches contents too), then fall back
    // to a filename match via `find` when Spotlight hasn't indexed the folder.
    tool(
      "find_documents",
      "Search the user's Documents folder for files matching a query (matches file names and contents). Returns matching absolute file paths.",
      { query: z.string().describe("words to look for, e.g. 'invoice april' or 'resume'") },
      async ({ query }) => {
        const run = (cmd: string, args: string[]) =>
          new Promise<string[]>((res) =>
            execFile(cmd, args, (_e, stdout) => res((stdout || "").split("\n").filter(Boolean))));
        let hits = await run("mdfind", ["-onlyin", DOCS, query]);
        if (!hits.length) {
          // ponytail: match any query word against the filename — enough for a
          // demo; not full-text like Spotlight.
          const word = query.split(/\s+/).sort((a, b) => b.length - a.length)[0] ?? query;
          hits = await run("find", [DOCS, "-iname", `*${word}*`, "-type", "f"]);
        }
        hits = hits.slice(0, 10);
        return { content: [{ type: "text", text: hits.length ? hits.join("\n") : "no matching files" }] };
      },
    ),
    // Send a Documents file back into the chat. Realpath-locked to Documents.
    tool(
      "send_document",
      "Send a file to the user in this chat. Use an absolute path returned by find_documents.",
      { path: z.string().describe("absolute path to a file inside the user's Documents folder") },
      async ({ path }) => {
        let real: string;
        try { real = realpathSync(path); } catch { return { content: [{ type: "text", text: "refused: file not found" }] }; }
        if (!isInsideDocs(real)) return { content: [{ type: "text", text: "refused: only files inside Documents can be sent" }] };
        if (!fileSender) return { content: [{ type: "text", text: "can't send files in this chat" }] };
        try { return { content: [{ type: "text", text: await fileSender(real) }] }; }
        catch (e) { return { content: [{ type: "text", text: "send failed: " + (e instanceof Error ? e.message : e) }] }; }
      },
    ),
  ],
});

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
      systemPrompt:
        "You are zepto-claw, a friendly, concise assistant chatting over WhatsApp. Answer directly. No coding-tool chatter. To show the user a web page, video, search, or directions, use open_url. To find a file they ask about, use find_documents, then send_document to deliver it. If find_documents returns several matches, pick the most likely one and send it.",
      mcpServers: { claw },
      allowedTools: ["mcp__claw__open_url", "mcp__claw__find_documents", "mcp__claw__send_document"],
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
