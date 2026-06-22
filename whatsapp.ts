// The mouth: zepto-claw on WhatsApp. whatsapp-web.js logs into WhatsApp Web,
// you scan a QR once, then every text you send runs ask() and texts back.
// Memory (db.ts) is shared with the terminal, so it remembers across both.
import pkg from "whatsapp-web.js";
const { Client, LocalAuth } = pkg;
import qrcode from "qrcode-terminal";
import { ask } from "./claude.js";
import { addMessage } from "./db.js";

// Only reply to a real one-to-one chat — never groups or status broadcasts,
// so the claw can't spam every group you're in.
export function isReplyable(from: string): boolean {
  return from.endsWith("@c.us");
}

if (import.meta.url === `file://${process.argv[1]}` && process.argv.includes("--check")) {
  // Self-check: the one branch that matters — who we answer.
  if (!isReplyable("123@c.us")) throw new Error("should reply to direct chats");
  if (isReplyable("123@g.us")) throw new Error("should ignore groups");
  if (isReplyable("status@broadcast")) throw new Error("should ignore status");
  console.log("whatsapp self-check OK");
} else if (import.meta.url === `file://${process.argv[1]}`) {
  const client = new Client({ authStrategy: new LocalAuth() });

  client.on("qr", (qr) => {
    console.log("scan this with WhatsApp → Settings → Linked devices:");
    qrcode.generate(qr, { small: true });
  });
  client.on("ready", () => console.log("zepto-claw has a mouth. text it on WhatsApp."));

  client.on("message", async (msg) => {
    if (!isReplyable(msg.from) || !msg.body.trim()) return;
    try {
      const reply = await ask(msg.body);
      addMessage("user", msg.body);
      addMessage("assistant", reply);
      await msg.reply(reply);
    } catch (err) {
      console.error("error:", err instanceof Error ? err.message : err);
    }
  });

  client.initialize();
}
