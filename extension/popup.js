const $ = (id) => document.getElementById(id);

async function render() {
  const s = await chrome.storage.local.get(["url", "key", "running", "last"]);
  $("url").value = s.url || "https://acemail.online";
  $("key").value = s.key || "";
  $("toggle").textContent = s.running ? "Stop" : "Start";
  $("toggle").className = s.running ? "off" : "";
  $("status").textContent = (s.running ? "Running. " : "Stopped. ") + (s.last || "");
}

$("toggle").addEventListener("click", async () => {
  const { running } = await chrome.storage.local.get("running");
  const url = $("url").value.trim().replace(/\/$/, "") || "https://acemail.online";
  const key = $("key").value.trim();
  if (!running && !/^acr_[0-9a-f]{64}$/.test(key)) {
    $("status").textContent = "Paste the runner key from AceMail > LinkedIn > Connect LinkedIn.";
    return;
  }
  await chrome.storage.local.set({ url, key, running: !running, nextAt: 0 });
  chrome.runtime.sendMessage({ type: running ? "stop" : "start" });
  render();
});

chrome.storage.onChanged.addListener(render);
render();
