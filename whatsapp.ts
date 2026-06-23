// The mouth: zepto-claw on WhatsApp. whatsapp-web.js logs into WhatsApp Web,
// you scan a QR once, then every text you send runs ask() and texts back.
// Memory (db.ts) is shared with the terminal, so it remembers across both.
import pkg from "whatsapp-web.js";
const { Client, LocalAuth, MessageMedia } = pkg;
import qrcode from "qrcode-terminal";
import { ask, briefing, onSendFile, onScheduleReminder, isInsideDocs } from "./claude.js";
import { addMessage } from "./db.js";

// Only reply to a real one-to-one chat — never groups or status broadcasts,
// so the claw can't spam every group you're in.
export function isReplyable(from: string): boolean {
  return from.endsWith("@c.us");
}

// Every reply is tagged so we recognise (and skip) our own messages — otherwise
// self-chat would have the claw answering its own answers forever.
const MARK = "🤖 ";

// Answer your own note-to-self chat AND direct chats from others, but never our
// own MARKed replies or empty/non-text bodies. recipientIsMe distinguishes the
// self-chat from messages you send other people — WhatsApp addresses the self
// chat with a @lid id that doesn't match your @c.us, so we ask "is it me?"
// instead of comparing raw ids.
type Msg = { fromMe: boolean; from: string; body: string };
export function shouldAnswer(msg: Msg, recipientIsMe: boolean): boolean {
  if (!msg.body.trim() || msg.body.startsWith(MARK)) return false;
  const selfChat = msg.fromMe && recipientIsMe;
  const fromOther = !msg.fromMe && isReplyable(msg.from);
  return selfChat || fromOther;
}

if (import.meta.url === `file://${process.argv[1]}` && process.argv.includes("--check")) {
  // Self-check: the one branch that matters — who we answer.
  if (!isReplyable("123@c.us")) throw new Error("should reply to direct chats");
  if (isReplyable("123@g.us")) throw new Error("should ignore groups");
  if (isReplyable("status@broadcast")) throw new Error("should ignore status");
  // The loop guard: self-chat replies, others reply, our own MARKed reply does not.
  if (!shouldAnswer({ fromMe: true, from: "1@c.us", body: "hi" }, true)) throw new Error("should answer self-chat");
  if (!shouldAnswer({ fromMe: false, from: "2@c.us", body: "hi" }, false)) throw new Error("should answer direct chat");
  if (shouldAnswer({ fromMe: true, from: "1@c.us", body: MARK + "hi" }, true)) throw new Error("must not answer our own reply");
  if (shouldAnswer({ fromMe: false, from: "2@g.us", body: "hi" }, false)) throw new Error("should ignore groups");
  if (shouldAnswer({ fromMe: true, from: "1@c.us", body: "hi" }, false)) throw new Error("must not answer messages I send other people");
  // File boundary: only realpaths inside Documents are sendable, no sibling/escape.
  if (!isInsideDocs("/Users/me/Documents/x.pdf", "/Users/me/Documents")) throw new Error("should allow files inside Documents");
  if (isInsideDocs("/Users/me/.ssh/id_rsa", "/Users/me/Documents")) throw new Error("must not allow files outside Documents");
  if (isInsideDocs("/Users/me/DocumentsEvil/x", "/Users/me/Documents")) throw new Error("must not allow sibling-prefix escape");
  console.log("whatsapp self-check OK");
} else if (import.meta.url === `file://${process.argv[1]}`) {
  const client = new Client({ authStrategy: new LocalAuth() });

  client.on("qr", (qr) => {
    console.log("scan this with WhatsApp → Settings → Linked devices:");
    qrcode.generate(qr, { small: true });
  });
  client.on("ready", () => {
    console.log("zepto-claw has a mouth. text it on WhatsApp.");
    // Heartbeat: push a live news briefing to your own chat. Fires once now so
    // a demo sees it immediately, then every interval.
    // ponytail: set HEARTBEAT_MS=60000 to demo fast; a daily cron is the real fit.
    const me = client.info.wid._serialized;
    const HEARTBEAT_MS = Number(process.env.HEARTBEAT_MS) || 60 * 60 * 1000;
    const beat = async () => {
      try {
        await client.sendMessage(me, MARK + (await briefing()));
      } catch (err) {
        console.error("heartbeat error:", err instanceof Error ? err.message : err);
      }
    };
    beat();
    setInterval(beat, HEARTBEAT_MS);

    // Water reminders: the set_water_reminder tool calls this to (re)start a
    // recurring nudge to your own chat. WATER_MS overrides the stated hours so a
    // demo fires in seconds instead of waiting 3 real hours.
    let waterTimer: ReturnType<typeof setInterval> | null = null;
    onScheduleReminder((hours) => {
      if (waterTimer) clearInterval(waterTimer);
      const ms = Number(process.env.WATER_MS) || hours * 60 * 60 * 1000;
      waterTimer = setInterval(() => {
        client.sendMessage(me, MARK + "💧 Water break! How much did you drink? (e.g. '500ml' or 'a glass')");
      }, ms);
      return ms;
    });
  });

  // message_create (not message) so it also fires for messages you send yourself.
  client.on("message_create", async (msg) => {
    // Only my own messages need the "is the recipient me?" lookup (self-chat).
    const recipientIsMe = msg.fromMe && (await client.getContactById(msg.to).then((c) => c.isMe).catch(() => false));
    if (!shouldAnswer(msg, recipientIsMe)) return;
    // Let the send_document tool attach a real file in this chat for this turn.
    onSendFile(async (path) => {
      await client.sendMessage(msg.from, MessageMedia.fromFilePath(path));
      return `sent ${path.split("/").pop()}`;
    });
    try {
      const reply = await ask(msg.body);
      addMessage("user", msg.body);
      addMessage("assistant", reply);
      await msg.reply(MARK + reply);
    } catch (err) {
      console.error("error:", err instanceof Error ? err.message : err);
    } finally {
      onSendFile(null);
    }
  });

  client.initialize();
}
