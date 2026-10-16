// AceMail LinkedIn Runner: polls AceMail for due LinkedIn steps and performs them
// in a background tab of your own browser, where you're already signed in to LinkedIn.

const TICK = "acemail-tick";
let busy = false;

const rand = (a, b) => a + Math.random() * (b - a);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function setLast(text) {
  await chrome.storage.local.set({ last: `${new Date().toLocaleTimeString()} ${text}` });
}

async function api(path, init = {}) {
  const { url, key } = await chrome.storage.local.get(["url", "key"]);
  return fetch(`${url}/api/public/linkedin/tasks${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
  });
}

async function workTab() {
  const { tabId } = await chrome.storage.local.get("tabId");
  if (tabId) {
    try { const t = await chrome.tabs.get(tabId); if (t) return t.id; } catch {}
  }
  const t = await chrome.tabs.create({ url: "about:blank", active: false, pinned: true });
  await chrome.storage.local.set({ tabId: t.id });
  return t.id;
}

function loaded(tabId) {
  return new Promise((resolve) => {
    const done = () => { chrome.tabs.onUpdated.removeListener(fn); resolve(); };
    const fn = (id, info) => { if (id === tabId && info.status === "complete") done(); };
    chrome.tabs.onUpdated.addListener(fn);
    setTimeout(done, 30000);
  });
}

// Runs inside the LinkedIn page. Must be self-contained.
async function pageAction(t) {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const human = (a, b) => sleep(a + Math.random() * (b - a));
  const visible = (el) => !!el && el.offsetParent !== null;
  const main = document.querySelector("main section") || document.querySelector("main") || document.body;
  const btns = (root) => [...(root || document).querySelectorAll("button, [role=menuitem], div[role=button]")].filter(visible);
  const label = (b) => `${b.getAttribute("aria-label") || ""} ${b.innerText || ""}`.trim();
  const find = (re, root) => btns(root).find((b) => re.test(label(b)));
  const click = async (re, root) => { const b = find(re, root); if (!b) return false; b.click(); await human(800, 1800); return true; };
  const openMore = () => click(/^More( actions)?\b/i, main);

  if (/\/(login|checkpoint|authwall|uas)/.test(location.pathname)) return ["later", "Not signed in to LinkedIn in this browser"];
  window.scrollBy(0, 300 + Math.random() * 500);
  await human(1500, 3500);

  if (t.action === "visit") return ["done"];

  if (t.action === "follow") {
    if (await click(/^(Follow|Follow \S.*)$/i, main)) return ["done"];
    if (await openMore() && await click(/^Follow/i)) return ["done"];
    return ["skipped", "Follow button not found (maybe already following)"];
  }

  if (t.action === "connect") {
    if (find(/Pending/i, main)) return ["done", "Already pending"];
    let ok = await click(/Invite .* to connect|^Connect$/i, main);
    if (!ok && await openMore()) ok = await click(/Invite .* to connect|^Connect$/i);
    if (!ok) return find(/^Message/i, main) ? ["done", "Already connected"] : ["failed", "Connect button not found"];
    if (t.message && await click(/Add a note/i)) {
      const box = document.querySelector("textarea[name=message], #custom-message, .artdeco-modal textarea");
      if (box) {
        box.focus();
        box.value = t.message.slice(0, 300);
        box.dispatchEvent(new Event("input", { bubbles: true }));
        await human(800, 1800);
        if (await click(/^Send( invitation| now)?$/i)) return ["done"];
      }
    }
    if (await click(/Send without a note|^Send( invitation| now)?$/i)) return ["done"];
    return ["failed", "Could not send invitation"];
  }

  if (t.action === "message") {
    if (!(await click(/^Message/i, main))) return ["later", "Not connected yet"];
    await human(1500, 3000);
    if (document.querySelectorAll(".msg-s-event-listitem--other").length) return ["skipped", "Replied on LinkedIn", true];
    const boxes = document.querySelectorAll("div.msg-form__contenteditable[contenteditable=true]");
    const box = boxes[boxes.length - 1];
    if (!box) return ["failed", "Message box not found"];
    box.focus();
    document.execCommand("insertText", false, t.message);
    box.dispatchEvent(new Event("input", { bubbles: true }));
    await human(1000, 2500);
    const send = [...document.querySelectorAll("button.msg-form__send-button, button[type=submit]")].filter(visible).pop();
    if (!send || send.disabled) return ["failed", "Send button not found"];
    send.click();
    await human(1000, 2000);
    return ["done"];
  }

  if (t.action === "endorse") return ["skipped", "Endorsing is a manual step"];
  return ["skipped", `Unknown action ${t.action}`];
}

async function runOne(t) {
  if (!t.profile_url) return ["skipped", "No LinkedIn link"];
  const tabId = await workTab();
  await chrome.tabs.update(tabId, { url: t.profile_url });
  await loaded(tabId);
  await wait(rand(3000, 6000));
  const [res] = await chrome.scripting.executeScript({ target: { tabId }, func: pageAction, args: [t] });
  return res?.result || ["failed", "No result from page"];
}

async function tick() {
  if (busy) return;
  const s = await chrome.storage.local.get(["running", "nextAt"]);
  if (!s.running || Date.now() < (s.nextAt || 0)) return;
  busy = true;
  try {
    const r = await api("");
    if (r.status === 401) {
      await chrome.storage.local.set({ running: false });
      return setLast("Runner key rejected. Create a new one in AceMail.");
    }
    const { tasks = [] } = await r.json();
    if (!tasks.length) {
      await chrome.storage.local.set({ nextAt: Date.now() + 10 * 60_000 });
      return setLast("No steps due. Checking again in 10 min.");
    }
    const t = tasks[0];
    let out;
    try { out = await runOne(t); } catch (e) { out = ["failed", String(e?.message || e).slice(0, 200)]; }
    const [status, note, replied] = out;
    await api("", { method: "POST", body: JSON.stringify({ taskId: t.id, status, note, replied: !!replied }) });
    await setLast(`${t.action}: ${status}${note ? ` (${note})` : ""}`);
    await chrome.storage.local.set({ nextAt: Date.now() + rand(45_000, 150_000) });
  } catch (e) {
    await setLast(`Could not reach AceMail: ${e?.message || e}`);
    await chrome.storage.local.set({ nextAt: Date.now() + 60_000 });
  } finally {
    busy = false;
  }
}

chrome.alarms.create(TICK, { periodInMinutes: 0.5 });
chrome.alarms.onAlarm.addListener((a) => { if (a.name === TICK) tick(); });
chrome.runtime.onMessage.addListener((m) => { if (m?.type === "start") tick(); });
chrome.tabs.onRemoved.addListener(async (id) => {
  const { tabId } = await chrome.storage.local.get("tabId");
  if (id === tabId) chrome.storage.local.remove("tabId");
});
