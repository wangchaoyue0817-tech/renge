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
  assert.match(source, /\.premium-social \{[^}]*padding: 13px;/);
  assert.match(source, /\.premium-match-panel \{[^}]*margin-top: 8px;[^}]*padding: 10px;/);
  assert.match(source, /\.premium-atlas, \.premium-social \{ width: 100%; \}/);
  assert.match(source, /\.premium-content \{[^}]*overflow-y: auto;/);
  assert.doesNotMatch(source, /新人首鉴福利|NEWCOMER GIFT|30元专鉴券/);
  assert.doesNotMatch(source, /class=&quot;premium-benefit&quot;|id=&quot;premium-open-sheet&quot;/);
  assert.doesNotMatch(source, /#(?:000|000000)\b|rgba?\(0,\s*0,\s*0/i);
  assert.doesNotMatch(source, /#050810|rgba\(5,\s*8,\s*16/i);
});

test("groups trait information and category action into one trend panel", async () => {
  const source = (await readFile(previewPath, "utf8"))
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"');
  const panel = source.match(
    /<div class="premium-match-panel">([\s\S]*?)<\/div>\s*<div class="premium-dots"/,
  );
  assert.ok(panel, "the trait and category content should share one visual panel");
  assert.equal((source.match(/class="premium-match-panel"/g) || []).length, 1);
  assert.match(panel[1], /id="premium-social-body"/);
  assert.match(panel[1], /id="premium-hot-strip"/);
  assert.match(panel[1], /id="premium-people"/);
  assert.match(panel[1], /id="premium-trait"/);
  assert.match(panel[1], /id="premium-percent"/);
  assert.match(panel[1], /<button[^>]*id="premium-go"[^>]*type="button"/);

  for (const selector of ["premium-social-body", "premium-hot-strip"]) {
    const styles = source.match(new RegExp(`\\.${selector} \\{([^}]+)\\}`));
    assert.ok(styles);
    assert.doesNotMatch(
      styles[1],
      /(?:^|;)\s*(?:background(?:-image|-color)?|border|border-radius|box-shadow):/,
      `${selector} must not retain independent card chrome`,
    );
  }
  assert.match(source, /\.premium-hot-strip \{[^}]*border-top: 1px solid/);
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
  assert.match(source, /aria-label=&quot;已点亮5类，领取1张专家鉴别券&quot;/);
  assert.match(source, /aria-label=&quot;集齐11类，解锁2张专家鉴别券&quot;/);
  assert.match(source, /id=&quot;premium-atlas-next&quot;&gt;再点亮5类领2张&lt;\/span&gt;/);
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
    ["aria-label", "已点亮5类，领取1张专家鉴别券"],
  ]);
  const status = { textContent: "领1张券" };
  const progressAttributes = new Map();
  const nextReward = { textContent: "再点亮5类领2张" };
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
  assert.equal(attributes.get("aria-disabled"), "true");
  assert.equal(
    attributes.get("aria-label"),
    "5类奖励已领取，已获得1张专家鉴别券",
  );
  assert.equal(status.textContent, "已领1张");
  assert.notEqual(button.disabled, true, "keep the claimed button in the keyboard focus order");
  assert.equal(attributes.has("disabled"), false, "use aria-disabled rather than native disabled");
  assert.equal(
    progressAttributes.get("aria-label"),
    "已点亮6类；5类奖励已领取1张专家鉴别券；集齐11类可领取2张专家鉴别券",
  );
  assert.equal(nextReward.textContent, "再点亮5类领2张");
  assert.deepEqual(messages, ["专家鉴别券 ×1 已领取"]);

  const claimedAttributes = [...attributes];
  claim({ currentTarget: button });
  assert.equal(messages.length, 1, "a claimed reward must not be granted again");
  assert.deepEqual([...attributes], claimedAttributes);
  assert.equal(status.textContent, "已领1张");
});

test("explains both reward thresholds and distinguishes claimable from locked rewards", async () => {
  const source = (await readFile(previewPath, "utf8"))
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"');
  assert.match(source, /点亮5类领1张，集齐11类领2张/);
  assert.doesNotMatch(source, /奖励档位已标注在进度条关键节点|再点亮2类/);

  const five = source.match(/<button\b([^>]*id="premium-atlas-reward"[^>]*)>([\s\S]*?)<\/button>/);
  assert.ok(five, "the unlocked five-category reward should be a button");
  assert.match(five[1], /type="button"/);
  assert.match(five[1], /aria-label="已点亮5类，领取1张专家鉴别券"/);
  assert.match(five[1], /aria-pressed="false"/);
  assert.doesNotMatch(five[1], /(?:^|\s)disabled(?:\s|=|$)|aria-disabled="true"/);
  assert.match(five[2], /<span class="premium-milestone-pill">\s*<b>5类<\/b>\s*<em>领1张券<\/em>\s*<\/span>/);

  assert.match(
    source,
    /<span class="premium-atlas-milestone premium-atlas-eleven" aria-label="集齐11类，解锁2张专家鉴别券">\s*<span class="premium-milestone-pill">\s*<b>11类<\/b>\s*<em>解锁2张<\/em>\s*<\/span>\s*<\/span>/,
  );
  assert.doesNotMatch(source, /<button\b[^>]*premium-atlas-eleven/);
  assert.equal((source.match(/class="premium-milestone-pill"/g) || []).length, 2);
});

test("floats both compact single-line reward pills on the progress track", async () => {
  const source = await readFile(previewPath, "utf8");
  const cssRule = (selector) => {
    const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const rule = source.match(new RegExp(`^${escapedSelector} \\{([^}]+)\\}`, "m"));
    assert.ok(rule, `missing CSS rule for ${selector}`);
    return rule[1];
  };
  const pixels = (rule, property) => {
    const declaration = rule.match(new RegExp(`(?:^|;)\\s*${property}:\\s*(\\d+(?:\\.\\d+)?)(?:px)?(?=\\s*(?:;|$))`));
    assert.ok(declaration, `missing ${property} in ${rule}`);
    return Number(declaration[1]);
  };
  const track = cssRule(".premium-atlas-track");
  const rail = cssRule(".premium-atlas-rail");
  const milestone = cssRule(".premium-atlas-milestone");
  const pill = cssRule(".premium-milestone-pill");
  const five = cssRule(".premium-atlas-five");
  const eleven = cssRule(".premium-atlas-eleven");

  assert.ok(pixels(track, "height") >= 8, "the progress track should be visibly thicker");
  assert.equal(pixels(track, "top"), 18);
  assert.equal(pixels(track, "left"), 2);
  assert.equal(pixels(track, "right"), 52);
  assert.equal(
    pixels(track, "top") + pixels(track, "height") / 2,
    pixels(milestone, "top") + pixels(milestone, "height") / 2,
    "reward pills should float centered on the track rather than below it",
  );
  assert.equal(pixels(rail, "height"), 44, "the whole progress area should occupy just one touch-target row");
  assert.equal(pixels(milestone, "width"), 104);
  assert.equal(pixels(milestone, "height"), 44, "keep the reward button's touch target at 44px");
  assert.match(milestone, /padding:\s*7px 0;/);
  assert.equal(pixels(pill, "width"), 104);
  assert.equal(pixels(pill, "height"), 30);
  assert.equal(pixels(pill, "border-radius"), 999);
  assert.match(pill, /flex-direction:\s*row;/);
  assert.match(milestone, /white-space:\s*nowrap;/);
  assert.match(pill, /border:\s*1px solid/);
  assert.match(pill, /background:/);
  assert.doesNotMatch(source, /\.premium-atlas-(?:milestone|five|eleven)[^{\n]*::before/);

  const fivePosition = five.match(/left:\s*calc\((\d+(?:\.\d+)?)% - (\d+(?:\.\d+)?)px\)/);
  assert.ok(fivePosition, "position the five-category node relative to the shortened track");
  assert.match(five, /transform:\s*translateX\(-50%\)/);
  assert.equal(pixels(eleven, "right"), 0);
  for (const railWidth of [248, 284, 338]) {
    const trackWidth = railWidth - pixels(track, "left") - pixels(track, "right");
    const fiveCenter = railWidth * Number(fivePosition[1]) / 100 - Number(fivePosition[2]);
    const expectedFiveCenter = pixels(track, "left") + trackWidth * 5 / 11;
    assert.ok(Math.abs(fiveCenter - expectedFiveCenter) < 0.02, "the first reward must stay at 5/11 progress across screen widths");
    const elevenCenter = railWidth - pixels(eleven, "right") - pixels(milestone, "width") / 2;
    assert.equal(elevenCenter, pixels(track, "left") + trackWidth, "the final reward should center on the track endpoint");
    assert.ok(fiveCenter - pixels(pill, "width") / 2 >= 0, "the first reward should stay within the card");
    assert.ok(elevenCenter - fiveCenter >= pixels(pill, "width"), "the reward pills must not overlap on narrow screens");
  }
  assert.doesNotMatch(source, /premium-milestone-icon|premium-milestone-copy|premium-ticket-spark|premium-ticket-check/);
  assert.match(source, /premium-atlas-eleven&quot;[^\n]*集齐11类，解锁2张专家鉴别券/);
  assert.equal((source.match(/class=&quot;premium-milestone-pill&quot;/g) || []).length, 2);
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
