/**
 * 调试用：把某个主题在页面里跑一遍，捕获真实报错。
 * 渲染器在主题抛异常时只会超时（__done 永不置位），看不到真正的原因。
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * 仓库根目录从**这个文件自己的位置**推出来，不写死绝对路径。
 * 写死过一次，后果是：装到技能目录之后它只能在那一台机器上跑，
 * 换台机器就 `ENOENT` —— 而故障排查那一节正好让人跑这个命令。
 */
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const themeId = process.argv[2] ?? "strata";
const palId = process.argv[3] ?? "brass";

const kit = readFileSync(resolve(ROOT, "packages/engine/kit.mjs"), "utf8")
  .replace(/^export\s+(function|const|let)\s+/gm, "$1 ");
const rngSrc = readFileSync(resolve(ROOT, "packages/engine/rng.mjs"), "utf8")
  .replace(/^export\s+(function|const|let)\s+/gm, "$1 ");
const themeSrc = readFileSync(resolve(ROOT, `packages/engine/themes/${themeId}.mjs`), "utf8")
  .replace(/^export\s+/gm, "");

const palMod = await import(resolve(ROOT, "packages/engine/palettes.mjs"));
const pal = palMod.PALETTES.find((p) => p.id === palId);

const { loadPlaywright } = await import(resolve(ROOT, "packages/engine/host.mjs"));
const { chromium } = loadPlaywright();
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1080, height: 864 } });

page.on("pageerror", (e) => {
  console.log("=== PAGEERROR ===");
  console.log(e.message);
  console.log(e.stack?.split("\n").slice(0, 12).join("\n"));
});
page.on("console", (m) => console.log(`[${m.type()}] ${m.text()}`));

const html = `<!doctype html><html><body style="margin:0;background:#000">
<canvas id="art" width="1080" height="864"></canvas>
<script>
${kit}
${rngSrc}
${themeSrc}
try {
  var cv = document.getElementById("art");
  var ctx = cv.getContext("2d");
  var rng = makeRng(12345);
  var palette = ${JSON.stringify(pal)};
  var t0 = performance.now();
  render(ctx, { w: 1080, h: 864, rng: rng, palette: palette, extra: {} });
  console.log("RENDER_OK_MS=" + Math.round(performance.now() - t0));
  window.__done = true;
} catch (e) {
  console.log("RENDER_THREW: " + e.message + "\\n" + e.stack);
  window.__done = true;
}
</script></body></html>`;

await page.setContent(html, { waitUntil: "load" });
await page.waitForFunction(() => window.__done === true, null, { timeout: 90000 }).catch(() => {
  console.log("!! 超时：render 没返回，说明卡在某个循环里");
});
await browser.close();
