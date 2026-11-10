export function renderErrorPage(error?: unknown): string {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "string"
      ? error
      : error && typeof error === "object" && "message" in error
      ? String((error as { message: unknown }).message)
      : error
      ? JSON.stringify(error)
      : "";

  const stack = error instanceof Error ? error.stack ?? "" : "";

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>This page didn't load</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      body { font: 15px/1.5 system-ui, -apple-system, sans-serif; background: #0c0a09; color: #f5f5f4; display: grid; place-items: center; min-height: 100vh; margin: 0; padding: 1.5rem; }
      .card { max-width: 32rem; width: 100%; text-align: center; padding: 2rem; border-radius: 1rem; border: 1px solid rgba(255,255,255,0.1); background: rgba(255,255,255,0.03); }
      h1 { font-size: 1.5rem; margin: 0 0 0.5rem; font-weight: 600; }
      p { color: #a8a29e; margin: 0 0 1.5rem; font-size: 0.875rem; }
      .err-box { text-align: left; background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.25); border-radius: 0.5rem; padding: 0.75rem; font-family: ui-monospace, monospace; font-size: 0.75rem; color: #f87171; max-height: 12rem; overflow-y: auto; margin-bottom: 1.5rem; white-space: pre-wrap; word-break: break-all; }
      .actions { display: flex; gap: 0.5rem; justify-content: center; flex-wrap: wrap; }
      a, button { padding: 0.5rem 1.25rem; border-radius: 0.375rem; font: inherit; cursor: pointer; text-decoration: none; border: 1px solid transparent; font-size: 0.875rem; font-weight: 500; }
      .primary { background: #ea580c; color: #fff; }
      .secondary { background: transparent; color: #f5f5f4; border-color: rgba(255,255,255,0.2); }
    </style>
  </head>
  <body>
    <div class="card">
      <h1>This page didn't load</h1>
      <p>Something went wrong on our end. You can try refreshing or head back home.</p>
      ${message ? `<div class="err-box"><strong>Error:</strong> ${message}${stack ? `\n\n${stack}` : ""}</div>` : ""}
      <div class="actions">
        <button class="primary" onclick="location.reload()">Try again</button>
        <a class="secondary" href="/">Go home</a>
      </div>
    </div>
  </body>
</html>`;
}
