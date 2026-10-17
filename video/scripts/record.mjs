// Records the REAL Scalehouse app for the demo video: a headless Chrome at 1920×1080 driven like a
// person, with a visible cursor and click ripples drawn into the page. Wallet steps use a test
// wallet injected into the page (EIP-1193 + EIP-6963) that signs in Node with the project's
// TESTNET owner key, so every click, signature and payment is real (on Arc testnet).
//   node scripts/record.mjs <clip> [...]     clips: home newhouse pay confirm receipt board attack guide
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import puppeteer from "puppeteer-core";
import { createPublicClient, createWalletClient, defineChain, http, hexToString, isHex } from "viem";
import { privateKeyToAccount } from "viem/accounts";

const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const FFMPEG = "C:/Users/Admin/Desktop/BUILTRA/tools/ffmpeg/bin/ffmpeg.exe";
const MAIN = "https://scalehouse-app.vercel.app";
const TEST = "https://scalehouse-testnet.vercel.app";
const env = Object.fromEntries(readFileSync("../.keys/testnet.env", "utf8").split(/\r?\n/).filter(Boolean).map((l) => l.split("=")));
const state = (() => {
  try {
    return JSON.parse(readFileSync("out/record-state.json", "utf8"));
  } catch {
    return {};
  }
})();
const save = () => writeFileSync("out/record-state.json", JSON.stringify(state, null, 2));

const arcTest = defineChain({ id: 5042002, name: "Arc Testnet", nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 }, rpcUrls: { default: { http: ["https://rpc.testnet.arc.io"] } } });
const account = privateKeyToAccount(env.OWNER_KEY);
const pub = createPublicClient({ chain: arcTest, transport: http() });
const wallet = createWalletClient({ account, chain: arcTest, transport: http() });

/** Handles wallet requests from the page, like a browser wallet that auto-approves. */
async function walletRequest(method, params) {
  switch (method) {
    case "eth_requestAccounts":
    case "eth_accounts":
      return [account.address];
    case "eth_chainId":
      return "0x" + arcTest.id.toString(16);
    case "wallet_switchEthereumChain":
    case "wallet_addEthereumChain":
      return null;
    case "personal_sign": {
      const [msg] = params;
      return account.signMessage({ message: isHex(msg) ? { raw: msg } : msg });
    }
    case "eth_signTypedData_v4": {
      const typed = JSON.parse(params[1]);
      const { EIP712Domain, ...types } = typed.types;
      return account.signTypedData({ domain: typed.domain, types, primaryType: typed.primaryType, message: typed.message });
    }
    case "eth_sendTransaction": {
      const t = params[0];
      return wallet.sendTransaction({ to: t.to, data: t.data, value: t.value ? BigInt(t.value) : undefined });
    }
    case "wallet_sendCalls":
    case "wallet_getCapabilities":
      throw Object.assign(new Error("Method not supported by this wallet"), { code: 4200 });
    default:
      return pub.request({ method, params });
  }
}

const PAGE_SETUP = `
(() => {
  // ── Test wallet: EIP-1193 provider announced over EIP-6963 ──
  const listeners = {};
  const provider = {
    isTestWallet: true,
    request: async ({ method, params }) => {
      const r = await window.__walletRequest(method, JSON.stringify(params ?? []));
      const o = JSON.parse(r);
      if (o.error) { const e = new Error(o.error.message); e.code = o.error.code; throw e; }
      return o.result;
    },
    on: (ev, fn) => ((listeners[ev] ||= []).push(fn), provider),
    removeListener: (ev, fn) => ((listeners[ev] = (listeners[ev] || []).filter((f) => f !== fn)), provider),
  };
  const info = { uuid: "7b1c0d7e-test-wallet", name: "Test Wallet", rdns: "app.scalehouse.testwallet",
    icon: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><rect width='32' height='32' rx='8' fill='%230f4a28'/><path d='M8 11h16v12H8z' fill='%23e8ae45'/></svg>" };
  const announce = () => window.dispatchEvent(new CustomEvent("eip6963:announceProvider", { detail: Object.freeze({ info, provider }) }));
  window.addEventListener("eip6963:requestProvider", announce);
  announce();

  // ── Visible cursor + click ripple ──
  const mk = () => {
    if (document.getElementById("__cur")) return;
    const c = document.createElement("div");
    c.id = "__cur";
    c.style.cssText = "position:fixed;left:0;top:0;z-index:2147483647;pointer-events:none;transform:translate(1700px,980px);transition:none";
    c.innerHTML = '<svg width="30" height="36" viewBox="0 0 24 28" style="filter:drop-shadow(0 4px 6px rgba(0,0,0,.35))"><path d="M2 2 L2 22 L7.5 17 L11 25 L14.5 23.5 L11 15.8 L18.5 15.8 Z" fill="#111" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/></svg>';
    document.documentElement.appendChild(c);
    window.__curPos = window.__curPos || { x: 1700, y: 980 };
    c.style.transform = "translate(" + window.__curPos.x + "px," + window.__curPos.y + "px)";
  };
  window.__cursorMove = (x, y, ms) => new Promise((res) => {
    mk();
    const c = document.getElementById("__cur");
    const s = { ...window.__curPos }, t0 = performance.now();
    const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
    const step = (now) => {
      const p = Math.min(1, (now - t0) / ms), e = ease(p);
      const cx = s.x + (x - s.x) * e, cy = s.y + (y - s.y) * e;
      window.__curPos = { x: cx, y: cy };
      c.style.transform = "translate(" + cx + "px," + cy + "px)";
      p < 1 ? requestAnimationFrame(step) : res();
    };
    requestAnimationFrame(step);
  });
  window.__ripple = (x, y) => {
    const r = document.createElement("div");
    r.style.cssText = "position:fixed;z-index:2147483646;pointer-events:none;left:" + (x - 26) + "px;top:" + (y - 26) + "px;width:52px;height:52px;border-radius:52px;border:3px solid #e8ae45;background:rgba(232,174,69,.18);transform:scale(.3);opacity:1;transition:transform .45s cubic-bezier(.2,.8,.2,1),opacity .45s";
    document.documentElement.appendChild(r);
    requestAnimationFrame(() => { r.style.transform = "scale(1.4)"; r.style.opacity = "0"; });
    setTimeout(() => r.remove(), 600);
  };
  document.addEventListener("DOMContentLoaded", () => {
    mk();
    // The recorder animates its own scrolling; the site's CSS smooth-scroll would make it lag.
    const st = document.createElement("style");
    st.textContent = "html,body{scroll-behavior:auto!important}";
    document.head.appendChild(st);
  });
})();
`;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function openBrowser() {
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: true,
    defaultViewport: { width: 1920, height: 1080, deviceScaleFactor: 1 },
    args: ["--window-size=1920,1080", "--hide-scrollbars", "--force-color-profile=srgb", "--disable-features=Translate"],
  });
  const page = await browser.newPage();
  await page.exposeFunction("__walletRequest", async (method, paramsJson) => {
    try {
      const result = await walletRequest(method, JSON.parse(paramsJson));
      return JSON.stringify({ result: typeof result === "bigint" ? "0x" + result.toString(16) : result });
    } catch (e) {
      return JSON.stringify({ error: { message: e.shortMessage ?? e.message, code: e.code ?? -32603 } });
    }
  });
  await page.evaluateOnNewDocument(PAGE_SETUP);
  await page.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "no-preference" }]);
  return { browser, page };
}

/** Person-like helpers. */
function actions(page) {
  const center = async (handle) => {
    const b = await handle.boundingBox();
    return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
  };
  const find = async (text, tag = "*", nth = 0) => {
    const hs = await page.$$(`xpath/.//${tag}[normalize-space(.)=${JSON.stringify(text)} or contains(normalize-space(.), ${JSON.stringify(text)})][not(.//${tag}[contains(normalize-space(.), ${JSON.stringify(text)})])]`);
    const exact = [];
    const partial = [];
    for (const h of hs) {
      if (!(await h.boundingBox())) continue;
      const t = (await h.evaluate((el) => el.textContent ?? "")).replace(/\s+/g, " ").trim();
      (t === text ? exact : partial).push(h);
    }
    const visible = exact.length > nth ? exact : [...exact, ...partial];
    if (!visible[nth]) throw new Error(`not found: ${text}`);
    return visible[nth];
  };
  const reveal = async (handle) => {
    await handle.evaluate((el) => {
      const r = el.getBoundingClientRect();
      if (r.top < 90 || r.bottom > innerHeight - 90) {
        const target = scrollY + r.top - innerHeight * 0.38;
        const s = scrollY, t0 = performance.now(), ms = 900;
        return new Promise((res) => {
          const step = (now) => {
            const p = Math.min(1, (now - t0) / ms), e = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
            scrollTo(0, s + (target - s) * e);
            p < 1 ? requestAnimationFrame(step) : res();
          };
          requestAnimationFrame(step);
        });
      }
    });
    await sleep(150);
  };
  const move = async (handle, ms = 700) => {
    await reveal(handle);
    const p = await center(handle);
    await page.evaluate((x, y, ms) => window.__cursorMove(x, y, ms), p.x, p.y, ms);
    return p;
  };
  const click = async (handle, ms = 700) => {
    const p = await move(handle, ms);
    await sleep(120);
    await page.evaluate((x, y) => window.__ripple(x, y), p.x, p.y);
    await page.mouse.click(p.x, p.y);
    await sleep(250);
  };
  const type = async (handle, text, delay = 55) => {
    await click(handle);
    await page.keyboard.type(text, { delay });
  };
  const scrollBy = async (dy, ms = 1400) =>
    page.evaluate(
      (dy, ms) =>
        new Promise((res) => {
          const s = scrollY, t0 = performance.now();
          const step = (now) => {
            const p = Math.min(1, (now - t0) / ms), e = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
            scrollTo(0, s + dy * e);
            p < 1 ? requestAnimationFrame(step) : res();
          };
          requestAnimationFrame(step);
        }),
      dy,
      ms,
    );
  const hover = async (x, y, ms = 700) => page.evaluate((x, y, ms) => window.__cursorMove(x, y, ms), x, y, ms);
  const waitText = (text, timeout = 120000) => page.waitForFunction((t) => document.body.innerText.includes(t), { timeout, polling: 300 }, text);
  return { find, click, type, move, scrollBy, hover, waitText, reveal };
}

/**
 * Puppeteer's screencast stretches time (frames are duplicated at 30fps but encoded at 25fps,
 * with rounding). Retime the recording so its length equals the measured wall-clock length,
 * as constant-30fps H.264.
 */
function retime(name, real) {
  const FFPROBE = FFMPEG.replace("ffmpeg.exe", "ffprobe.exe");
  // The webm has no duration header: count it by decoding.
  const tmp = `out/frames/${name}-raw.mp4`;
  mkdirSync("out/frames", { recursive: true });
  execFileSync(FFMPEG, ["-v", "error", "-y", "-i", `public/clips/${name}.webm`, "-c:v", "libx264", "-preset", "veryfast", "-crf", "14", "-pix_fmt", "yuv420p", tmp]);
  const video = Number(execFileSync(FFPROBE, ["-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", tmp]).toString().trim());
  const k = real / video;
  execFileSync(FFMPEG, ["-v", "error", "-y", "-i", tmp, "-vf", `setpts=PTS*${k.toFixed(6)},fps=30,format=yuv420p`, "-c:v", "libx264", "-preset", "medium", "-crf", "16", `public/clips/${name}.mp4`]);
  return { frames: Math.round(real * 30), seconds: real, k };
}

/**
 * (Unused) Frame-accurate capture: Chrome's own screencast frames, each with its capture timestamp,
 * written to disk, then assembled into a constant-30fps MP4 that matches wall-clock time exactly.
 */
async function startCapture(page, name) {
  const dir = `out/frames/${name}`;
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  const cdp = await page.createCDPSession();
  const frames = [];
  let n = 0;
  cdp.on("Page.screencastFrame", async ({ data, metadata, sessionId }) => {
    const file = `${dir}/${String(n++).padStart(6, "0")}.jpg`;
    writeFileSync(file, Buffer.from(data, "base64"));
    frames.push({ file, ts: metadata.timestamp });
    cdp.send("Page.screencastFrameAck", { sessionId }).catch(() => {});
  });
  await cdp.send("Page.startScreencast", { format: "jpeg", quality: 92, maxWidth: 1920, maxHeight: 1080, everyNthFrame: 1 });
  const startEpoch = Date.now() / 1000;
  return {
    startEpoch,
    stop: async () => {
      await cdp.send("Page.stopScreencast").catch(() => {});
      const endEpoch = Date.now() / 1000;
      // ffmpeg concat list: each frame lasts until the next one; the first starts at 0.
      const lines = [];
      frames.forEach((f, i) => {
        const from = i === 0 ? startEpoch : f.ts;
        const to = i + 1 < frames.length ? frames[i + 1].ts : endEpoch;
        lines.push(`file '${f.file.replace(/^out\/frames\/[^/]+\//, "")}'`, `duration ${Math.max(0.001, to - from).toFixed(4)}`);
      });
      if (frames.length) lines.push(`file '${frames[frames.length - 1].file.replace(/^out\/frames\/[^/]+\//, "")}'`);
      writeFileSync(`${dir}/list.txt`, lines.join("\n"));
      execFileSync(FFMPEG, ["-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", `${dir}/list.txt`, "-vf", "fps=30,format=yuv420p", "-c:v", "libx264", "-preset", "medium", "-crf", "16", `public/clips/${name}.mp4`]);
      return { frames: frames.length, seconds: endEpoch - startEpoch };
    },
  };
}

async function record(name, fn) {
  mkdirSync("public/clips", { recursive: true });
  const { browser, page } = await openBrowser();
  const a = actions(page);
  const marks = [];
  const t0 = { v: 0 };
  const mark = (label) => marks.push({ label, t: (Date.now() - t0.v) / 1000 });
  let rec;
  try {
    await fn(page, a, {
      start: async () => {
        const sc = await page.screencast({ path: `public/clips/${name}.webm`, ffmpegPath: FFMPEG });
        t0.v = Date.now();
        rec = {
          stop: async () => {
            const real = (Date.now() - t0.v) / 1000;
            await sc.stop();
            return retime(name, real);
          },
        };
        mark("start");
      },
      mark,
    });
    mark("end");
  } catch (e) {
    await page.screenshot({ path: `out/rec/fail-${name}.png` }).catch(() => {});
    const errs = await page.evaluate(() => [...document.querySelectorAll(".text-red")].map((n) => n.textContent).join(" | ")).catch(() => "");
    console.log("FAILED", name, e.message.split("\n")[0], "page errors:", errs);
    throw e;
  } finally {
    if (rec) {
      const info = await rec.stop();
      console.log(name, `${info.seconds.toFixed(1)}s real, retimed ×${info.k?.toFixed(3)}`);
    }
    await browser.close();
  }
  state[name] = { ...(state[name] ?? {}), marks };
  save();
  console.log(name, marks.map((m) => `${m.label}@${m.t.toFixed(1)}`).join("  "));
}

const CLIPS = {
  /** Mainnet home page: hero, then a slow tour down the page. */
  home: (page, a, r) =>
    (async () => {
      await page.goto(MAIN, { waitUntil: "networkidle2" });
      await r.start();
      await sleep(4500);
      r.mark("hero");
      await a.hover(1250, 520, 1200);
      await sleep(2500);
      r.mark("scroll");
      // Slow tour: each section gets time for its own animation (charts, sticky steps, layers).
      const total = await page.evaluate(() => document.documentElement.scrollHeight - innerHeight);
      let y = 0;
      let i = 0;
      while (y < total - 40) {
        const dy = Math.min(480, total - y);
        await a.scrollBy(dy, 1500);
        y += dy;
        await a.hover(700 + ((i * 337) % 700), 380 + ((i * 211) % 400), 900);
        await sleep(1500);
        r.mark(`s${i++}`);
      }
      await sleep(1500);
    })(),

  /** Testnet: connect the wallet and open a house, for real. */
  newhouse: (page, a, r) =>
    (async () => {
      await page.goto(`${TEST}/house/new`, { waitUntil: "networkidle2" });
      await r.start();
      await sleep(1500);
      r.mark("connect");
      await a.click(await a.find("Connect", "button"));
      await sleep(1800);
      r.mark("name");
      await a.type(await page.$('input[placeholder^="e.g. Mama"]'), "Mama Ada Provisions", 70);
      await sleep(600);
      r.mark("limits");
      const nums = await page.$$("input.field.figure");
      await a.click(nums[0]);
      await page.keyboard.down("Control");
      await page.keyboard.press("A");
      await page.keyboard.up("Control");
      await page.keyboard.type("5", { delay: 90 });
      await a.click(nums[1]);
      await page.keyboard.down("Control");
      await page.keyboard.press("A");
      await page.keyboard.up("Control");
      await page.keyboard.type("25", { delay: 90 });
      await sleep(700);
      r.mark("open");
      await a.click(await a.find("Open the house", "button"));
      await page.waitForFunction(() => location.pathname.match(/^\/house\/\d+$/), { timeout: 180000, polling: 500 });
      r.mark("opened");
      state.house = Number(page.url().match(/house\/(\d+)/)[1]);
      save();
      await sleep(4500);
    })(),

  /** Testnet: Pay someone on the new house, through to Paid, then the receipt. */
  pay: (page, a, r) =>
    (async () => {
      await page.goto(`${TEST}/house/${state.house}`, { waitUntil: "networkidle2" });
      await a.click(await a.find("Connect", "button"), 10);
      await sleep(2000);
      await page.evaluate(() => scrollTo(0, 0));
      await r.start();
      await sleep(1500);
      r.mark("box");
      const box = await a.find("Pay someone", "h2");
      await a.reveal(box);
      await sleep(800);
      r.mark("wallet");
      await a.type(await page.$('input[aria-label="Their wallet address"]'), env.SUPPLIER_ADDRESS, 28);
      r.mark("amount");
      await a.type(await page.$('input[aria-label="Amount"]'), "0.10", 120);
      r.mark("what");
      await a.type(await page.$('input[aria-label="What it\'s for"]'), "Bread delivery, Ada", 60);
      await sleep(500);
      r.mark("pay");
      await a.click(await a.find("Pay", "button"));
      await a.waitText("Checking the payment", 120000).catch(() => {});
      r.mark("checking");
      await a.hover(1500, 760, 1500);
      await a.waitText("Paid ✓", 180000);
      r.mark("paid");
      await sleep(3500);
      r.mark("receipt");
      const rc = await a.find("Open receipt", "a");
      state.ticket = Number((await rc.evaluate((el) => el.getAttribute("href"))).match(/\d+/)[0]);
      save();
      await a.click(rc);
      await page.waitForFunction(() => location.pathname.startsWith("/t/"), { timeout: 60000 });
      await sleep(3500);
      r.mark("share");
      await a.move(await a.find("Share receipt on WhatsApp", "a"));
      await sleep(1500);
      r.mark("scroll");
      await a.scrollBy(700, 2200);
      await sleep(3500);
      r.mark("replay");
      await a.scrollBy(500, 1800);
      await sleep(3000);
    })(),

  /** Testnet: a bigger payment waits; the confirmer opens their link (no wallet) and taps Confirm. */
  confirm: (page, a, r) =>
    (async () => {
      await page.goto(`${TEST}/house/${state.house}`, { waitUntil: "networkidle2" });
      await a.click(await a.find("Connect", "button"), 10);
      await sleep(2000);
      // Set auto-approve to 0.50 so a 1.00 payment waits for a person (setup through the API, not recorded).
      const at = Math.floor(Date.now() / 1000);
      const msg = `Scalehouse: auto-approve link confirmers for house #${state.house} on chain 5042002.\nTime: ${at}`;
      const res = await fetch(`${TEST}/api/auto-approve`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ houseId: state.house, action: "set", limit: "0.5", at, signature: await account.signMessage({ message: msg }) }),
      });
      if (!res.ok) throw new Error("auto-approve set: " + (await res.text()));
      await page.reload({ waitUntil: "networkidle2" });
      await sleep(2500);
      await page.evaluate(() => scrollTo(0, 0));
      await r.start();
      await sleep(1200);
      r.mark("card");
      const card = await a.find("Confirmers", "h2");
      await a.reveal(card);
      await sleep(1000);
      r.mark("add");
      await a.type(await page.$('input[aria-label="Confirmer name"]'), "Chidi (storekeeper)", 60);
      await a.click(await a.find("Add confirmer", "button"));
      await a.waitText("Send link on WhatsApp", 120000);
      r.mark("added");
      await sleep(1200);
      await a.move(await a.find("Send link on WhatsApp", "a"));
      await sleep(1500);
      r.mark("bigpay");
      const top = await a.find("Pay someone", "h2");
      await a.reveal(top);
      await a.type(await page.$('input[aria-label="Their wallet address"]'), env.SUPPLIER_ADDRESS, 22);
      await a.type(await page.$('input[aria-label="Amount"]'), "1.00", 120);
      await a.type(await page.$('input[aria-label="What it\'s for"]'), "Weekly flour order", 55);
      await a.click(await a.find("Pay", "button"));
      await a.waitText("waiting for your confirmer", 180000);
      r.mark("waiting");
      await sleep(1500);
      await a.move(await a.find("Ask Chidi", "a"));
      await sleep(1500);
      // Open Chidi's private link, as Chidi would on their phone.
      const link = await page.evaluate((h) => JSON.parse(localStorage.getItem(`scalehouse:confirmers:5042002:${h}`) ?? "[]")[0]?.link, state.house);
      state.confirmLink = link;
      save();
      r.mark("link");
      await page.goto(link, { waitUntil: "networkidle2" });
      await sleep(2500);
      r.mark("tap");
      await a.click(await a.find("Confirm", "button"));
      await a.waitText("Confirmed", 120000);
      r.mark("confirmed");
      await sleep(3000);
    })(),

  /** Mainnet receipt for ticket #5. */
  receipt: (page, a, r) =>
    (async () => {
      await page.goto(`${MAIN}/t/5`, { waitUntil: "networkidle2" });
      await r.start();
      await sleep(2500);
      r.mark("top");
      await a.move(await a.find("See it on the explorer", "a"));
      await sleep(1500);
      r.mark("scroll");
      await a.scrollBy(650, 2200);
      await sleep(3500);
      r.mark("more");
      await a.scrollBy(450, 1800);
      await sleep(2500);
    })(),

  /** Mainnet public board. */
  board: (page, a, r) =>
    (async () => {
      await page.goto(`${MAIN}/board`, { waitUntil: "networkidle2" });
      await r.start();
      await sleep(3000);
      r.mark("scroll");
      await a.scrollBy(600, 2200);
      await sleep(2500);
      await a.scrollBy(500, 2000);
      await sleep(2000);
    })(),

  /** Testnet attack lab: get paid by the agent, then two real attacks. */
  attack: (page, a, r) =>
    (async () => {
      await page.goto(`${TEST}/attack`, { waitUntil: "networkidle2" });
      await r.start();
      await sleep(2000);
      r.mark("payme");
      const fresh = privateKeyToAccount(("0x" + [...crypto.getRandomValues(new Uint8Array(32))].map((b) => b.toString(16).padStart(2, "0")).join(""))).address;
      await a.type(await page.$('input[aria-label="Your wallet address"]'), fresh, 24);
      await a.click(await a.find("Pay me", "button"));
      await a.waitText("You got paid", 240000).catch(() => {});
      // The result card renders below the attacks: scroll to it and let it be read.
      await a.reveal(await a.find("You got paid"));
      r.mark("paidme");
      await sleep(4000);
      await a.reveal(await a.find("Launch attack", "button", 0));
      await sleep(600);
      r.mark("inject");
      await a.click(await a.find("Launch attack", "button", 0));
      await page.waitForFunction(() => document.body.innerText.includes("ignored the instruction"), { timeout: 240000, polling: 500 }).catch(() => {});
      await a.reveal(await a.find("ignored the instruction"));
      r.mark("injected");
      await sleep(4500);
      await a.reveal(await a.find("Launch attack", "button", 1));
      await sleep(600);
      r.mark("hijack");
      await a.click(await a.find("Launch attack", "button", 1));
      await a.waitText("couldn't redirect", 240000).catch(() => {});
      await a.reveal(await a.find("couldn't redirect"));
      r.mark("hijacked");
      await sleep(4500);
    })(),

  /** Mainnet guide page. */
  guide: (page, a, r) =>
    (async () => {
      await page.goto(`${MAIN}/guide`, { waitUntil: "networkidle2" });
      await r.start();
      await sleep(2500);
      await a.scrollBy(600, 2200);
      await sleep(2500);
      await a.scrollBy(600, 2200);
      await sleep(2000);
    })(),
};

for (const name of process.argv.slice(2)) {
  if (!CLIPS[name]) throw new Error(`unknown clip ${name}`);
  await record(name, CLIPS[name]);
}
