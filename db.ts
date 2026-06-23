import { DatabaseSync } from "node:sqlite";

const db = new DatabaseSync("zeptoclaw.db");
db.exec("CREATE TABLE IF NOT EXISTS messages (role TEXT, content TEXT)");
db.exec("CREATE TABLE IF NOT EXISTS water (day TEXT, ml INTEGER)");

const insert = db.prepare("INSERT INTO messages (role, content) VALUES (?, ?)");
const selectAll = db.prepare("SELECT role, content FROM messages ORDER BY rowid");
const insertWater = db.prepare("INSERT INTO water (day, ml) VALUES (?, ?)");
const sumWater = db.prepare("SELECT COALESCE(SUM(ml), 0) AS total FROM water WHERE day = ?");

export function addMessage(role: string, content: string) {
  insert.run(role, content);
}

export function getMessages(): { role: string; content: string }[] {
  return selectAll.all() as { role: string; content: string }[];
}

const today = () => new Date().toISOString().slice(0, 10); // local-ish YYYY-MM-DD

export function addWater(ml: number) {
  insertWater.run(today(), ml);
}

export function waterToday(): number {
  return (sumWater.get(today()) as { total: number }).total;
}

// Self-check: write then read round-trips, then delete exactly the rows it
// inserted so the real conversation history stays clean. Run `npx tsx db.ts`.
if (import.meta.url === `file://${process.argv[1]}`) {
  const before = getMessages().length;
  addMessage("user", "ping");
  addMessage("assistant", "pong");
  const rows = getMessages();
  if (rows.length !== before + 2) throw new Error("expected 2 new rows");
  const [u, a] = rows.slice(-2);
  if (u.role !== "user" || u.content !== "ping") throw new Error("user row mismatch");
  if (a.role !== "assistant" || a.content !== "pong") throw new Error("assistant row mismatch");
  db.exec("DELETE FROM messages WHERE rowid IN (SELECT rowid FROM messages ORDER BY rowid DESC LIMIT 2)");
  if (getMessages().length !== before) throw new Error("self-check left rows behind");
  // Water: a logged amount adds to today's total; clean up just that one row.
  const wBefore = waterToday();
  addWater(250);
  if (waterToday() !== wBefore + 250) throw new Error("water not summed for today");
  db.exec("DELETE FROM water WHERE rowid = (SELECT MAX(rowid) FROM water)");
  if (waterToday() !== wBefore) throw new Error("water self-check left a row behind");
  console.log("db self-check OK: round-trip passed,", before, "messages still stored");
}
