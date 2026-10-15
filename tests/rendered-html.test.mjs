import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { runInNewContext } from "node:vm";

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
  const source = await readFile(previewPath, "utf8");
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
  assert.match(source, /\.premium-atlas, \.premium-social \{ width: 100%; \}/);
  assert.match(source, /\.premium-content \{[^}]*overflow-y: auto;/);
  assert.doesNotMatch(source, /新人首鉴福利|NEWCOMER GIFT|30元专鉴券/);
  assert.doesNotMatch(source, /class=&quot;premium-benefit&quot;|id=&quot;premium-open-sheet&quot;/);
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
  assert.match(source, /#premium-atlas-benefit'\)\.addEventListener\('click', openSheet\)/);
  assert.doesNotMatch(source, /premium-atlas-light|去点亮/);
  assert.match(source, /id=&quot;premium-atlas-overview&quot;[^>]*aria-controls=&quot;premium-atlas-gallery&quot;/);
  assert.match(source, /id=&quot;premium-atlas-expand&quot;[^>]*aria-controls=&quot;premium-atlas-gallery&quot;/);
  assert.match(source, /aria-label=&quot;领取5类里程碑奖励&quot;/);
  assert.match(source, /aria-label=&quot;集齐11类，解锁2张专家鉴别券&quot;/);
  assert.match(source, /id=&quot;premium-atlas-next&quot;&gt;再点亮2类&lt;\/span&gt;/);
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

test("claiming the five-category reward updates visible and accessible state only once", async () => {
  const source = (await readFile(previewPath, "utf8")).replaceAll("&gt;", ">");
  const handler = source.match(
    /root\.querySelector\('#premium-atlas-reward'\)\.addEventListener\('click', (event => \{[\s\S]*?\n  \})\);/,
  );
  assert.ok(handler, "the five-category reward must remain claimable");

  const attributes = new Map([
    ["aria-pressed", "false"],
    ["aria-label", "领取5类里程碑奖励"],
  ]);
  const status = { textContent: "待领取" };
  const progressAttributes = new Map();
  const nextReward = { textContent: "再点亮2类" };
  const messages = [];
  const button = {
    getAttribute: (name) => attributes.get(name),
    setAttribute: (name, value) => attributes.set(name, value),
    querySelector: (selector) => {
      assert.equal(selector, "em");
      return status;
    },
  };
  const root = {
    querySelector: (selector) => {
      if (selector === ".premium-atlas-rail") {
        return { setAttribute: (name, value) => progressAttributes.set(name, value) };
      }
      assert.equal(selector, "#premium-atlas-next");
      return nextReward;
    },
  };
  const claim = runInNewContext(`(${handler[1]})`, {
    root,
    showToast: (message) => messages.push(message),
  });

  claim({ currentTarget: button });
  assert.equal(attributes.get("aria-pressed"), "true");
  assert.equal(attributes.get("aria-label"), "5类里程碑奖励已领取");
  assert.equal(status.textContent, "已领取");
  assert.equal(
    progressAttributes.get("aria-label"),
    "已点亮6类；5类奖励已领取；11类可领取2张专家鉴别券",
  );
  assert.equal(nextReward.textContent, "再点亮2类");
  assert.deepEqual(messages, ["专家鉴别券 ×1 已领取"]);

  claim({ currentTarget: button });
  assert.equal(messages.length, 1, "a claimed reward must not be granted again");
});

test("uses simple milestone labels with dots centered on a thicker progress track", async () => {
  const source = await readFile(previewPath, "utf8");
  const cssRule = (selector) => {
    const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const rule = source.match(new RegExp(`${escapedSelector} \\{([^}]+)\\}`));
    assert.ok(rule, `missing CSS rule for ${selector}`);
    return rule[1];
  };
  const pixels = (rule, property) => {
    const declaration = rule.match(new RegExp(`(?:^|;)\\s*${property}:\\s*(\\d+(?:\\.\\d+)?)(?:px)?(?=\\s*(?:;|$))`));
    assert.ok(declaration, `missing ${property} in ${rule}`);
    return Number(declaration[1]);
  };
  const track = cssRule(".premium-atlas-track");
  const milestone = cssRule(".premium-atlas-milestone");
  const dot = cssRule(".premium-atlas-milestone::before");

  assert.ok(pixels(track, "height") >= 8, "the progress track should be visibly thicker");
  assert.equal(
    pixels(track, "top") + pixels(track, "height") / 2,
    pixels(milestone, "top") + pixels(dot, "top") + pixels(dot, "height") / 2,
    "milestone dots should share the progress track centerline",
  );
  assert.doesNotMatch(source, /premium-milestone-icon|premium-milestone-copy|premium-ticket-spark|premium-ticket-check/);
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
