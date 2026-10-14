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
    "8bc8586928037f9a850272b8a30f4a8075f56c4b746a94dea3f19756c957b41f",
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
  assert.doesNotMatch(source, /PERSONALITY MATCH|与你同频的鉴定偏好/);
  assert.match(source, /\.premium-social \{[^}]*min-height: 205px;[^}]*padding: 13px;/);
  assert.match(source, /\.premium-social-body \{[^}]*min-height: 68px;[^}]*margin: 8px 0 7px;/);
  assert.match(source, /\.premium-hot-strip \{[^}]*min-height: 56px;[^}]*padding: 7px 8px;/);
  assert.match(source, /\.premium-benefit, \.premium-atlas, \.premium-social \{ width: 100%; \}/);
  assert.match(source, /\.premium-content \{[^}]*overflow-y: auto;/);
  assert.doesNotMatch(source, /#(?:000|000000)\b|rgba?\(0,\s*0,\s*0/i);
  assert.doesNotMatch(source, /#050810|rgba\(5,\s*8,\s*16/i);
});

test("places the interactive achievement atlas above the trend card", async () => {
  const source = await readFile(previewPath, "utf8");
  const atlasIndex = source.indexOf("class=&quot;premium-atlas&quot;");
  const trendIndex = source.indexOf("class=&quot;premium-social&quot;");

  assert.ok(atlasIndex > 0);
  assert.ok(trendIndex > atlasIndex);
  assert.match(source, /达人图鉴/);
  assert.match(source, /点亮品类，专家鉴别券免费领/);
  assert.match(source, /id=&quot;premium-atlas-gallery&quot;[^>]*hidden/);
  assert.match(source, /openSheet\('atlas'\)/);
  assert.match(source, /选择下一个点亮品类/);

  const badgeNames = [
    "bag",
    "beauty",
    "clothes",
    "coin",
    "food",
    "jade",
    "persona",
    "porcelain",
    "shoes",
    "watch",
    "wine",
  ];
  await Promise.all(
    badgeNames.map((name) =>
      readFile(new URL(`../public/assets/achievement/${name}.png`, import.meta.url)),
    ),
  );
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
