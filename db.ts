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

// Self-check: write then read round-trips. Run with `npx tsx db.ts`.
if (import.meta.url === `file://${process.argv[1]}`) {
  const before = getMessages().length;
  addMessage("user", "ping");
  addMessage("assistant", "pong");
  const rows = getMessages();
  if (rows.length !== before + 2) throw new Error("expected 2 new rows");
  const [u, a] = rows.slice(-2);
  if (u.role !== "user" || u.content !== "ping") throw new Error("user row mismatch");
  if (a.role !== "assistant" || a.content !== "pong") throw new Error("assistant row mismatch");
  console.log("db self-check OK:", rows.length, "messages total");
}
