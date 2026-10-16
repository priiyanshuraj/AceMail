#!/usr/bin/env node
// AceMail LinkedIn runner. Runs on YOUR computer, in a real browser window, logged in as you.
// AceMail never sees your LinkedIn password: you sign in once inside the window that opens,
// and the session is kept in a local folder (~/.acemail-linkedin).
//
// Setup (one time):
//   npm i -g playwright && npx playwright install chromium
// Run:
//   ACEMAIL_KEY=acr_... node acemail-linkedin-runner.mjs
// Optional: ACEMAIL_URL=https://acemail.online  HEADLESS=1 (only after first login)
//
// LinkedIn's terms forbid automation and can restrict accounts. Keep daily limits low.

import { chromium } from "playwright";
import os from "node:os";
import path from "node:path";

const BASE = (process.env.ACEMAIL_URL || "https://acemail.online").replace(/\/$/, "");
const KEY = process.env.ACEMAIL_KEY;
if (!KEY) { console.error("Set ACEMAIL_KEY to the runner key from AceMail > LinkedIn > Connect"); process.exit(1); }
const API = `${BASE}/api/public/linkedin/tasks`;
const headers = { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const human = (min, max) => sleep(min + Math.random() * (max - min));

async function report(taskId, status, note, replied = false) {
  const r = await fetch(API, { method: "POST", headers, body: JSON.stringify({ taskId, status, note, replied }) });
  if (!r.ok) console.error("Report failed", r.status, await r.text());
}

async function ensureLogin(page) {
  await page.goto("https://www.linkedin.com/feed/", { waitUntil: "domcontentloaded" });
  if (!/\/(login|checkpoint|authwall|uas)/.test(page.url())) return;
  console.log("Sign in to LinkedIn in the browser window (codes and app approvals work). Waiting...");
  await page.waitForURL(/linkedin\.com\/feed/, { timeout: 10 * 60_000 });
  console.log("Signed in. Session saved for next time.");
}

async function clickByText(page, re, scope) {
  const root = scope ?? page;
  const btn = root.getByRole("button", { name: re }).first();
  if (await btn.isVisible().catch(() => false)) { await btn.click(); return true; }
  return false;
}

async function openMore(page) {
  const main = page.locator("main section").first();
  return clickByText(page, /^More( actions)?$/i, main);
}

async function doTask(page, t) {
  await page.goto(t.profile_url, { waitUntil: "domcontentloaded" });
  await human(3000, 7000);
  await page.mouse.wheel(0, 400 + Math.random() * 600);
  await human(1500, 4000);
  const main = page.locator("main section").first();

  if (t.action === "visit") return ["done"];

  if (t.action === "follow") {
    if (await clickByText(page, /^Follow\b/i, main)) return ["done"];
    if (await openMore(page) && await clickByText(page, /Follow/i)) return ["done"];
    return ["skipped", "Follow button not found (maybe already following)"];
  }

  if (t.action === "connect") {
    if (await main.getByRole("button", { name: /Pending/i }).first().isVisible().catch(() => false)) return ["done", "Already pending"];
    if (await main.getByRole("button", { name: /^Message/i }).first().isVisible().catch(() => false)
        && !(await main.getByRole("button", { name: /Connect/i }).first().isVisible().catch(() => false))) return ["done", "Already connected"];
    let ok = await clickByText(page, /Invite .* to connect|^Connect$/i, main);
    if (!ok && await openMore(page)) ok = await clickByText(page, /Invite .* to connect|Connect/i, page.getByRole("menu"));
    if (!ok) return ["failed", "Connect button not found"];
    await human(1000, 2500);
    if (t.message) {
      if (await clickByText(page, /Add a note/i)) {
        await page.getByRole("textbox").last().fill(t.message.slice(0, 300));
        await human(800, 2000);
        if (await clickByText(page, /^Send( invitation)?$/i)) return ["done"];
      }
    }
    if (await clickByText(page, /Send without a note|^Send( invitation)?$/i)) return ["done"];
    return ["failed", "Could not send invitation"];
  }

  if (t.action === "message") {
    const msgBtn = main.getByRole("button", { name: /^Message/i }).first();
    if (!(await msgBtn.isVisible().catch(() => false))) return ["later", "Not connected yet"];
    await msgBtn.click();
    await human(1500, 3000);
    const box = page.locator("div.msg-form__contenteditable[contenteditable=true]").last();
    if (!(await box.isVisible().catch(() => false))) return ["failed", "Message box not found"];
    // If they already wrote to us, stop the sequence instead of sending.
    const theirs = await page.locator(".msg-s-event-listitem--other").count().catch(() => 0);
    if (theirs > 0) return ["skipped", "Replied on LinkedIn", true];
    await box.click();
    await page.keyboard.insertText(t.message);
    await human(1000, 2500);
    if (await clickByText(page, /^Send$/i)) { await human(1000, 2000); await page.keyboard.press("Escape").catch(() => {}); return ["done"]; }
    return ["failed", "Send button not found"];
  }

  if (t.action === "endorse") return ["skipped", "Endorsing is a manual step"];
  return ["skipped", `Unknown action ${t.action}`];
}

const ctx = await chromium.launchPersistentContext(path.join(os.homedir(), ".acemail-linkedin"), {
  headless: process.env.HEADLESS === "1", viewport: { width: 1280, height: 900 },
});
const page = ctx.pages()[0] ?? (await ctx.newPage());
await ensureLogin(page);
console.log("Runner connected to", BASE);

for (;;) {
  let tasks = [];
  try {
    const r = await fetch(API, { headers });
    if (r.status === 401) { console.error("Runner key rejected. Create a new one in AceMail."); process.exit(1); }
    tasks = (await r.json()).tasks ?? [];
  } catch (e) { console.error("Could not reach AceMail", e.message); }
  if (!tasks.length) { await sleep(10 * 60_000); continue; }
  for (const t of tasks) {
    if (!t.profile_url) { await report(t.id, "skipped", "No LinkedIn link"); continue; }
    try {
      const [status, note, replied] = await doTask(page, t);
      await report(t.id, status, note, !!replied);
      console.log(new Date().toLocaleTimeString(), t.action, t.profile_url, status, note ?? "");
    } catch (e) {
      await report(t.id, "failed", String(e.message).slice(0, 200));
    }
    await human(45_000, 150_000); // human pacing between actions
  }
}
