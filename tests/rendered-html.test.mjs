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
    "5bac27d2504b906932780c71b01b208a1e82ddeaff6fd7e6c013923e864cb214",
  );

  const source = html.toString("utf8");
  assert.match(source, /Content-Security-Policy/i);
  assert.match(source, /<iframe\b[^>]*\bsandbox=/i);
  assert.match(source, /--premium-blue: light-dark\(#595ff2, #595ff2\)/);
  assert.match(source, /--premium-purple: light-dark\(#7b55ea, #7b55ea\)/);
  assert.match(source, /--premium-bg-deep: light-dark\(#0b1028, #0b1028\)/);
  assert.match(source, /linear-gradient\(112deg, #5b68ed 0%, #7753dd 58%, #a660d1 100%\)/);
  assert.match(source, /class=&quot;premium-sync-glyph&quot;/);
  assert.match(source, /id=&quot;premium-sync-gradient&quot;/);
  assert.match(source, /\.premium-hot-icon svg \{[^}]*stroke-width: 1\.65/);
  assert.doesNotMatch(source, /data-lucide=&quot;orbit&quot;/);
  assert.match(source, /与你同频的鉴定偏好/);
  assert.doesNotMatch(source, /#(?:000|000000)\b|rgba?\(0,\s*0,\s*0/i);
  assert.doesNotMatch(source, /#050810|rgba\(5,\s*8,\s*16/i);
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
