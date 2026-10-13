import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const previewPath = new URL(
  "../public/miniapp-card-preview-v2.html",
  import.meta.url,
);

async function renderRoot() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("root redirects to the supplied visualization", async () => {
  const response = await renderRoot();
  assert.equal(response.status, 307);
  assert.equal(response.headers.get("location"), "/miniapp-card-preview-v2.html");
});

test("keeps the supplied HTML byte-identical and sandboxed", async () => {
  const html = await readFile(previewPath);
  const sha256 = createHash("sha256").update(html).digest("hex");

  assert.equal(
    sha256,
    "7ddd54fc4194e1bd3c4c1470888b06f7eb3c29c4976c1550fb6abdc07b5b7b3b",
  );

  const source = html.toString("utf8");
  assert.match(source, /Content-Security-Policy/i);
  assert.match(source, /<iframe\b[^>]*\bsandbox=/i);
});

test("tracks the Sites project and production route", async () => {
  const [page, layout, hosting] = await Promise.all([
    readFile(new URL("app/page.tsx", root), "utf8"),
    readFile(new URL("app/layout.tsx", root), "utf8"),
    readFile(new URL(".openai/hosting.json", root), "utf8"),
  ]);

  assert.match(page, /redirect\("\/miniapp-card-preview-v2\.html"\)/);
  assert.match(layout, /lang="zh-CN"/);
  assert.equal(
    JSON.parse(hosting).project_id,
    "appgprj_6ace13433a548191b32976e8972c180f",
  );
});
