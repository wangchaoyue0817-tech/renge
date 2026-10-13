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

test("keeps the visualization sandboxed after the design update", async () => {
  const html = await readFile(previewPath);
  const sha256 = createHash("sha256").update(html).digest("hex");

  assert.equal(
    sha256,
    "3593b9064e41478f9f2857075ce9a8e401a9e3e9b69b32f7269aa5c9bf7d4f18",
  );

  const source = html.toString("utf8");
  assert.match(source, /Content-Security-Policy/i);
  assert.match(source, /<iframe\b[^>]*\bsandbox=/i);
  assert.match(source, /--premium-blue: light-dark\(#595ff2, #595ff2\)/);
  assert.match(source, /--premium-purple: light-dark\(#7b55ea, #7b55ea\)/);
  assert.match(source, /linear-gradient\(112deg, #5b68ed 0%, #7753dd 58%, #a660d1 100%\)/);
  assert.match(source, /与你同频的鉴定偏好/);
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
