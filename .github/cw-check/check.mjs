// CountryWars_BP の自動チェック（AI なしの簡易版）
//
// 使い方（GitHub Actions の pr-check.yml から呼ぶ。手元でも動く。依存なし・Node 20 以上）
//   node .github/cw-check/check.mjs --head <PR を入れた後のフォルダ> [--base <PR の前のフォルダ>]
//        [--diff <git diff の出力ファイル>] [--summary <Markdown の出力先>] [--json <結果の出力先>] [--annotate]
//
// - head と base の両方を調べ、この PR で「新しく出た」問題だけを報告する（前からある問題では失敗させない）
// - --diff を渡すと、足された行から「レビューで見てほしいところ」を拾う（ルールは watch.json）
// - 新しいエラーが1つでもあれば終了コード 1

import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SKIP_DIRS = new Set(["node_modules", ".git", ".github"]);
const MARKER = "<!-- cw-pr-check -->";
const MAX_HITS_PER_RULE = 15;

// ---------------------------------------------------------------- 小道具

function parseArgs(argv) {
  const a = {};
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (!k.startsWith("--")) continue;
    const name = k.slice(2);
    if (name === "annotate") a.annotate = true;
    else a[name] = argv[++i];
  }
  return a;
}

function walk(root, rel = "") {
  const out = [];
  let entries;
  try {
    entries = fs.readdirSync(path.join(root, rel), { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    if (SKIP_DIRS.has(e.name)) continue;
    const r = rel ? `${rel}/${e.name}` : e.name;
    if (e.isDirectory()) out.push(...walk(root, r));
    else if (e.isFile()) out.push(r);
  }
  return out;
}

function lineOf(text, index) {
  let n = 1;
  for (let i = 0; i < index && i < text.length; i++) if (text.charCodeAt(i) === 10) n++;
  return n;
}

function sha1(s) {
  return crypto.createHash("sha1").update(s).digest("hex");
}

// コメントを空白に置き換える（位置と改行は変えない）。文字列の中身は残す。
// js=true のときは '…'・`…`・正規表現リテラルも文字列として扱う
function stripComments(text, js) {
  const out = text.split("");
  const n = text.length;
  let i = 0;
  let lastSig = ""; // 直前の空白以外の文字（正規表現か割り算かの見分けに使う）
  const blank = (from, to) => {
    for (let k = from; k < to; k++) if (out[k] !== "\n" && out[k] !== "\r") out[k] = " ";
  };
  while (i < n) {
    const c = text[i];
    const d = text[i + 1];
    if (c === "/" && d === "/") {
      const end = text.indexOf("\n", i);
      const e = end === -1 ? n : end;
      blank(i, e);
      i = e;
      continue;
    }
    if (c === "/" && d === "*") {
      const end = text.indexOf("*/", i + 2);
      const e = end === -1 ? n : end + 2;
      blank(i, e);
      i = e;
      continue;
    }
    if (c === '"' || (js && (c === "'" || c === "`"))) {
      let k = i + 1;
      while (k < n && text[k] !== c) {
        if (text[k] === "\\") k++;
        else if (c !== "`" && text[k] === "\n") break;
        k++;
      }
      i = k + 1;
      lastSig = c;
      continue;
    }
    if (js && c === "/" && (lastSig === "" || "(,=:[!&|?{};+-*%<>~^".includes(lastSig) || /\b(return|typeof|case|do|else|in|of|void|yield|await)$/.test(text.slice(Math.max(0, i - 8), i).trimEnd()))) {
      // 正規表現リテラル
      let k = i + 1;
      let inClass = false;
      while (k < n && text[k] !== "\n") {
        const ch = text[k];
        if (ch === "\\") { k += 2; continue; }
        if (ch === "[") inClass = true;
        else if (ch === "]") inClass = false;
        else if (ch === "/" && !inClass) break;
        k++;
      }
      i = k + 1;
      lastSig = "/";
      continue;
    }
    if (!/\s/.test(c)) lastSig = c;
    i++;
  }
  return out.join("");
}

function parseJsonLoose(text) {
  const t = text.replace(/^﻿/, "");
  try {
    return { value: JSON.parse(t) };
  } catch {
    /* コメント入りかもしれない（BDS はコメントを読み飛ばす） */
  }
  const s = stripComments(t, false);
  try {
    return { value: JSON.parse(s) };
  } catch (e) {
    const m = /position (\d+)/.exec(e.message);
    return {
      error: e.message.replace(/\s*in JSON at position \d+.*$/s, "").replace(/\s*\(line \d+ column \d+\)/, ""),
      line: m ? lineOf(s, Number(m[1])) : 1,
    };
  }
}

// JS の構文チェック。同じ中身は1回だけ調べる（head と base でほとんど同じなので）
const syntaxCache = new Map();
let tmpDir = null;
function checkSyntax(code) {
  const h = sha1(code);
  if (syntaxCache.has(h)) return syntaxCache.get(h);
  tmpDir ??= fs.mkdtempSync(path.join(os.tmpdir(), "cwcheck-"));
  const f = path.join(tmpDir, `${h}.mjs`);
  fs.writeFileSync(f, code);
  const r = spawnSync(process.execPath, ["--check", f], { encoding: "utf8" });
  fs.rmSync(f, { force: true });
  let res = null;
  if (r.status !== 0) {
    const err = r.stderr || "";
    const lm = /\.mjs:(\d+)/.exec(err);
    const mm = /^(\w*Error: .*)$/m.exec(err);
    res = { line: lm ? Number(lm[1]) : 1, message: mm ? mm[1] : err.trim().split("\n").pop() };
  }
  syntaxCache.set(h, res);
  return res;
}

// 呼び出しの引数の数（トップレベルのカンマの数 + 1）
function countArgs(code, openIndex) {
  let depth = 0;
  let count = 1;
  let empty = true;
  for (let i = openIndex; i < code.length; i++) {
    const c = code[i];
    if (c === "(" || c === "[" || c === "{") depth++;
    else if (c === ")" || c === "]" || c === "}") {
      depth--;
      if (depth === 0) return empty ? 0 : count;
    } else if (c === "," && depth === 1) count++;
    else if (depth === 1 && !/\s/.test(c)) empty = false;
  }
  return count;
}

// ---------------------------------------------------------------- パック全体の検査

const VANILLA_LOOT = /^loot_tables\/(entities|chests|gameplay|blocks|equipment|pots|spawners|vault|dispensers)\//;

function scanPack(root) {
  const findings = [];
  const add = (level, rule, file, line, message) => findings.push({ level, rule, file, line, message });
  const files = walk(root);
  const fileSet = new Set(files);
  const lowerMap = new Map(files.map((f) => [f.toLowerCase(), f]));

  // manifest
  let manifestModules = new Set();
  if (fileSet.has("manifest.json")) {
    const r = parseJsonLoose(fs.readFileSync(path.join(root, "manifest.json"), "utf8"));
    if (r.value) manifestModules = new Set((r.value.dependencies || []).map((d) => d.module_name).filter(Boolean));
  }

  // JSON
  const json = new Map(); // file -> { value, text }
  for (const f of files.filter((f) => f.endsWith(".json"))) {
    const text = fs.readFileSync(path.join(root, f), "utf8");
    const r = parseJsonLoose(text);
    if (r.error) add("error", "json-parse", f, r.line, `JSON として読めません（${r.error}）。BDS はこのファイルを読み込みません`);
    else json.set(f, { value: r.value, text });
  }

  // 定義の一覧（エンティティ・アイテム・ブロック）
  const entities = new Map(); // id -> [{file, events:Set, groups:Set}]
  const items = new Map();
  const blocks = new Map();
  for (const [f, { value }] of json) {
    const ent = value?.["minecraft:entity"];
    const item = value?.["minecraft:item"];
    const block = value?.["minecraft:block"];
    if (f.startsWith("entities/") && ent?.description?.identifier) {
      const id = ent.description.identifier;
      if (!entities.has(id)) entities.set(id, []);
      entities.get(id).push({ file: f, events: new Set(Object.keys(ent.events || {})), groups: new Set(Object.keys(ent.component_groups || {})) });
    }
    if (f.startsWith("items/") && item?.description?.identifier) {
      const id = item.description.identifier;
      if (!items.has(id)) items.set(id, []);
      items.get(id).push(f);
    }
    if (f.startsWith("blocks/") && block?.description?.identifier) {
      const id = block.description.identifier;
      if (!blocks.has(id)) blocks.set(id, []);
      blocks.get(id).push(f);
    }
  }
  for (const [kind, map] of [["エンティティ", entities], ["アイテム", items], ["ブロック", blocks]]) {
    for (const [id, defs] of map) {
      if (defs.length < 2) continue;
      const fs_ = defs.map((d) => (typeof d === "string" ? d : d.file));
      for (const f of fs_) add("error", "duplicate-id", f, 1, `${kind} ${id} が ${fs_.length} か所で定義されています（${fs_.join("、")}）。BDS はどれか1つしか使いません`);
    }
  }
  const allCustomEvents = new Set();
  for (const defs of entities.values()) for (const d of defs) for (const e of d.events) allCustomEvents.add(e);

  // エンティティの中身
  for (const [f, { value, text }] of json) {
    const ent = value?.["minecraft:entity"];
    if (!f.startsWith("entities/") || !ent) continue;
    const id = ent.description?.identifier ?? "(identifier なし)";
    const events = ent.events || {};
    const groups = ent.component_groups || {};
    const evNames = new Set(Object.keys(events));
    const grNames = new Set(Object.keys(groups));
    const lineFor = (re, after = 0) => {
      re.lastIndex = after;
      const m = re.exec(text);
      return m ? lineOf(text, m.index) : 1;
    };
    const eventsAt = Math.max(0, text.search(/"events"\s*:/));

    // event の参照（target が self のもの）が定義されているか
    const refs = [];
    const collect = (node) => {
      if (Array.isArray(node)) return node.forEach(collect);
      if (!node || typeof node !== "object") return;
      if (typeof node.event === "string") refs.push({ event: node.event, target: node.target });
      for (const v of Object.values(node)) collect(v);
    };
    collect(ent.components);
    collect(groups);
    collect(events);
    // events の中の "trigger": "名前"
    const collectTrigger = (node) => {
      if (Array.isArray(node)) return node.forEach(collectTrigger);
      if (!node || typeof node !== "object") return;
      if (typeof node.trigger === "string") refs.push({ event: node.trigger, target: "self" });
      for (const v of Object.values(node)) collectTrigger(v);
    };
    collectTrigger(events);
    const seen = new Set();
    for (const r of refs) {
      if (r.target !== undefined && r.target !== "self") continue;
      if (evNames.has(r.event) || seen.has(r.event)) continue;
      seen.add(r.event);
      const esc = r.event.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      add("error", "entity-event-missing", f, lineFor(new RegExp(`"${esc}"`, "g")), `${id} の中でイベント ${r.event} を呼んでいますが、events に定義がありません`);
    }

    // events の add / remove が使うコンポーネントグループ
    const seenG = new Set();
    const checkGroups = (node) => {
      if (Array.isArray(node)) return node.forEach(checkGroups);
      if (!node || typeof node !== "object") return;
      for (const key of ["add", "remove"]) {
        const cg = node[key]?.component_groups;
        if (Array.isArray(cg)) {
          for (const g of cg) {
            if (grNames.has(g) || seenG.has(g)) continue;
            seenG.add(g);
            const esc = String(g).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
            add("error", "entity-group-missing", f, lineFor(new RegExp(`"${esc}"`, "g"), eventsAt), `${id} のイベントがコンポーネントグループ ${g} を${key === "add" ? "足そう" : "外そう"}としていますが、component_groups に定義がありません`);
          }
        }
      }
      for (const v of Object.values(node)) checkGroups(v);
    };
    checkGroups(events);

    // events の中の run_command は使えない（イベントごと無効になり「event does not exist」になる）
    const hasKey = (node, key) => {
      if (Array.isArray(node)) return node.some((v) => hasKey(v, key));
      if (!node || typeof node !== "object") return false;
      return Object.keys(node).includes(key) || Object.values(node).some((v) => hasKey(v, key));
    };
    for (const [name, body] of Object.entries(events)) {
      if (hasKey(body, "run_command")) {
        const esc = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const at = text.search(new RegExp(`"${esc}"\\s*:\\s*\\{`));
        add("error", "entity-run-command", f, lineFor(/"run_command"/g, Math.max(0, at)), `${id} のイベント ${name} に run_command があります。今の BDS では使えず、イベントごと無効になります（「The event … does not exist」のエラーになる）。queue_command に書き換えてください`);
      }
    }

    // spawn_egg_interaction には offspring が要る
    if (hasKey(ent, "minecraft:spawn_egg_interaction") && !hasKey(ent, "minecraft:offspring")) {
      add("warning", "entity-spawn-egg", f, lineFor(/"minecraft:spawn_egg_interaction"/g), `${id} に minecraft:spawn_egg_interaction があるのに minecraft:offspring がありません。作られるたびに ERROR がログに出ます（子どもの形が無いなら spawn_egg_interaction を消す）`);
    }

    // ルートテーブルのファイルがあるか
    const tables = [];
    const collectTables = (node) => {
      if (Array.isArray(node)) return node.forEach(collectTables);
      if (!node || typeof node !== "object") return;
      if (typeof node.table === "string" && node.table.endsWith(".json")) tables.push(node.table);
      for (const v of Object.values(node)) collectTables(v);
    };
    collectTables(ent.components);
    collectTables(groups);
    for (const t of new Set(tables)) {
      if (fileSet.has(t) || VANILLA_LOOT.test(t)) continue;
      const esc = t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      add("warning", "loot-missing", f, lineFor(new RegExp(`"${esc}"`, "g")), `${id} のルートテーブル ${t} がありません（何も落とさなくなります）`);
    }
  }

  // ルートテーブルから別のルートテーブルを呼んでいる
  for (const [f, { value, text }] of json) {
    if (!f.startsWith("loot_tables/")) continue;
    const names = [];
    const collect = (node) => {
      if (Array.isArray(node)) return node.forEach(collect);
      if (!node || typeof node !== "object") return;
      if (node.type === "loot_table" && typeof node.name === "string") names.push(node.name);
      for (const v of Object.values(node)) collect(v);
    };
    collect(value);
    for (const t of new Set(names)) {
      const tt = t.endsWith(".json") ? t : `${t}.json`;
      if (fileSet.has(tt) || VANILLA_LOOT.test(tt)) continue;
      add("warning", "loot-missing", f, lineOf(text, Math.max(0, text.indexOf(t))), `呼んでいるルートテーブル ${t} がありません`);
    }
  }

  // スクリプト
  const knownItems = new Set([...items.keys(), ...blocks.keys(), ...[...entities.keys()].map((e) => `${e}_spawn_egg`)]);
  for (const f of files.filter((f) => f.startsWith("scripts/") && /\.(m?js)$/.test(f))) {
    const raw = fs.readFileSync(path.join(root, f), "utf8");
    const syn = checkSyntax(raw);
    if (syn) {
      add("error", "js-syntax", f, syn.line, `構文エラー: ${syn.message}。このファイルを読み込む BP 全体が動かなくなります`);
      continue;
    }
    const code = stripComments(raw, true);

    // import の行き先
    const seenIdx = new Set();
    const res = [
      /\bimport\s+(?:[\w$*{}\s,]+?\s+from\s+)?(["'])([^"'\n]+)\1/g,
      /\bexport\s+(?:\*(?:\s+as\s+[\w$]+)?|\{[^}]*\})\s+from\s+(["'])([^"'\n]+)\1/g,
      /\bimport\s*\(\s*(["'])([^"'\n]+)\1\s*\)/g,
    ];
    for (const re of res) {
      for (const m of code.matchAll(re)) {
        if (seenIdx.has(m.index)) continue;
        seenIdx.add(m.index);
        const spec = m[2];
        const line = lineOf(code, m.index);
        if (spec.startsWith(".") || spec.startsWith("/")) {
          const target = path.posix.normalize(path.posix.join(path.posix.dirname(f), spec));
          if (!target.startsWith("scripts/")) {
            add("error", "import-outside", f, line, `import "${spec}" が scripts フォルダの外を指しています。BDS は scripts の外を読めません`);
          } else if (!fileSet.has(target) && !fileSet.has(`${target}.js`)) {
            const near = lowerMap.get(target.toLowerCase()) || lowerMap.get(`${target}.js`.toLowerCase());
            add("error", "import-missing", f, line, near
              ? `import "${spec}" のファイルは大文字・小文字が違います（実際は ${near}）。Windows では動いても、サーバー（Linux）では見つからず BP 全体が読み込みに失敗します`
              : `import "${spec}" のファイルがありません。BP 全体が読み込みに失敗します`);
          }
        } else if (!manifestModules.has(spec)) {
          add("error", "import-module", f, line, `import "${spec}" は manifest.json の dependencies にありません。BDS では読み込めません`);
        }
      }
    }

    // スクリプトから呼ぶイベント・作るエンティティ・アイテム
    for (const m of code.matchAll(/\btriggerEvent\(\s*["']([^"']+)["']/g)) {
      const ev = m[1];
      if (ev.startsWith("minecraft:") || allCustomEvents.has(ev)) continue;
      add("warning", "script-event-unknown", f, lineOf(code, m.index), `triggerEvent("${ev}") のイベントが、どのエンティティの events にもありません（実行時に「event does not exist」のエラーになります）`);
    }
    for (const m of code.matchAll(/\bspawnEntity\(\s*["'](cw:[^"']+)["']/g)) {
      if (entities.has(m[1].split("<")[0])) continue;
      add("warning", "script-entity-unknown", f, lineOf(code, m.index), `spawnEntity("${m[1]}") のエンティティが entities にありません`);
    }
    for (const m of code.matchAll(/\bnew\s+ItemStack\(\s*["'](cw:[^"']+)["']/g)) {
      if (knownItems.has(m[1])) continue;
      add("warning", "script-item-unknown", f, lineOf(code, m.index), `new ItemStack("${m[1]}") のアイテムが items・blocks にありません（実行時にエラーになります）`);
    }

    // Script API の落とし穴（countrywars スキルの「Script API の落とし穴」）
    if (/entityItemDrop/.test(code)) {
      for (const m of code.matchAll(/\bof\s+[\w$.]+\.items\s*\)/g)) {
        add("warning", "api-items-forof", f, lineOf(code, m.index), "entityItemDrop の ev.items は for...of で回せません（TypeError: value is not iterable）。添字のループか Array.from を使ってください");
      }
    }
    for (const m of code.matchAll(/\.applyKnockback\(/g)) {
      const n = countArgs(code, m.index + m[0].length - 1);
      if (n >= 4) add("warning", "api-knockback", f, lineOf(code, m.index), `applyKnockback に引数が ${n} 個あります。今の API は applyKnockback({ x, z }, 垂直の強さ) の2つです（古い形は黙って効きません）`);
    }
  }

  return findings;
}

// ---------------------------------------------------------------- 差分（diff）

function parseDiff(text) {
  const files = new Map();
  let cur = null;
  let oldPath = null;
  let newLine = 0;
  for (const raw of text.split("\n")) {
    const line = raw.replace(/\r$/, "");
    if (line.startsWith("diff --git ")) {
      cur = null;
      oldPath = null;
      continue;
    }
    if (line.startsWith("--- ")) {
      const p = line.slice(4).trim();
      oldPath = p === "/dev/null" ? null : p.replace(/^a\//, "");
      continue;
    }
    if (line.startsWith("+++ ")) {
      const p = line.slice(4).trim();
      if (p === "/dev/null") {
        if (oldPath) files.set(oldPath, { path: oldPath, added: [], isNew: false, deleted: true });
        cur = null;
      } else {
        const np = p.replace(/^b\//, "");
        cur = { path: np, added: [], isNew: oldPath === null, deleted: false };
        files.set(np, cur);
      }
      continue;
    }
    if (!cur) continue;
    const h = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(line);
    if (h) {
      newLine = Number(h[1]);
      continue;
    }
    if (line.startsWith("+")) cur.added.push({ line: newLine++, text: line.slice(1) });
    else if (line.startsWith(" ")) newLine++;
  }
  return [...files.values()];
}

function reviewPoints(diffFiles, watch) {
  const hits = new Map(); // rule.id -> { rule, items: [] }
  const push = (rule, item) => {
    if (!hits.has(rule.id)) hits.set(rule.id, { rule, items: [] });
    hits.get(rule.id).items.push(item);
  };
  const lineRules = watch.rules.map((r) => ({ ...r, fre: new RegExp(r.files), pre: new RegExp(r.pattern, "i") }));
  const fileRules = watch.fileRules.map((r) => ({ ...r, fre: new RegExp(r.files) }));
  for (const df of diffFiles) {
    if (df.path.startsWith("node_modules/")) continue;
    for (const r of fileRules) {
      if (r.fre.test(df.path)) push(r, { file: df.path, line: df.added[0]?.line ?? 1, text: df.deleted ? "（削除）" : df.isNew ? "（新しいファイル）" : `（${df.added.length} 行追加・変更）` });
    }
    if (df.deleted || df.path.startsWith(".github/")) continue;
    for (const r of lineRules) {
      if (!r.fre.test(df.path)) continue;
      for (const a of df.added) if (r.pre.test(a.text)) push(r, { file: df.path, line: a.line, text: a.text.trim() });
    }
  }
  // スクリプト → ドロップ・取引・レシピ → そのほか（モブの装備など）の順に並べる
  const prio = (f) => (f.startsWith("scripts/") ? 0 : /^(loot_tables|trading|recipes)\//.test(f) ? 1 : 2);
  const groups = [...hits.values()];
  for (const g of groups) g.items.sort((a, b) => prio(a.file) - prio(b.file) || a.file.localeCompare(b.file) || a.line - b.line);

  // 1つのスクリプトに「アイテムを増やす処理」と「貴重なアイテム・確率など」が両方ある
  const combos = [];
  const combo = watch.combo;
  if (combo) {
    const byFile = new Map();
    for (const g of groups) {
      for (const it of g.items) {
        if (!it.file.startsWith("scripts/")) continue;
        if (!byFile.has(it.file)) byFile.set(it.file, new Map());
        const m = byFile.get(it.file);
        if (!m.has(g.rule.id)) m.set(g.rule.id, { rule: g.rule, items: [] });
        m.get(g.rule.id).items.push(it);
      }
    }
    for (const [file, m] of byFile) {
      const needs = combo.need.filter((id) => m.has(id));
      const withs = combo.with.filter((id) => m.has(id));
      if (!needs.length || !withs.length) continue;
      const lines = new Map();
      for (const id of [...needs, ...withs]) for (const it of m.get(id).items) lines.set(it.line, it);
      combos.push({
        file,
        titles: [...needs, ...withs].map((id) => m.get(id).rule.title),
        items: [...lines.values()].sort((a, b) => a.line - b.line),
      });
    }
  }
  return { groups, combos };
}

function notesFromDiff(diffFiles) {
  const notes = [];
  const live = diffFiles.filter((d) => !d.path.startsWith("node_modules/") && !d.path.startsWith(".github/"));
  const newScripts = live.filter((d) => d.isNew && /^scripts\/.*\.m?js$/.test(d.path)).map((d) => d.path);
  const needRestart = live.filter((d) => /^(entities|items|blocks|loot_tables|trading|recipes|spawn_rules|feature_rules|features|structures|item_catalog)\//.test(d.path) || d.path === "manifest.json").map((d) => d.path);
  const scripts = live.filter((d) => d.path.startsWith("scripts/"));
  if (newScripts.length) notes.push(`新しいスクリプトのファイルがあります（${newScripts.map((p) => `\`${p}\``).join("、")}）。\`reload\` では読み込まれず、BP 全体が失敗します。本番に効くのは次の定期再起動からです`);
  if (needRestart.length) notes.push(`エンティティ・アイテム・ブロック・ドロップ・取引・レシピなどの定義を変えています（${needRestart.length} ファイル）。\`reload\` では効かず、次の定期再起動で効きます`);
  if (!needRestart.length && !newScripts.length && scripts.length) notes.push("変更はスクリプトだけです。本番では `reload` か次の定期再起動で効きます");
  if (live.some((d) => d.path.startsWith("node_modules/"))) notes.push("node_modules を変えています");
  return notes;
}

// ---------------------------------------------------------------- まとめ

function keyOf(f) {
  return `${f.rule}|${f.file}|${f.message}`;
}

function compare(head, base) {
  if (!base) return { added: head, fixed: [], existing: [] };
  const baseCount = new Map();
  for (const f of base) baseCount.set(keyOf(f), (baseCount.get(keyOf(f)) || 0) + 1);
  const headCount = new Map();
  for (const f of head) headCount.set(keyOf(f), (headCount.get(keyOf(f)) || 0) + 1);
  const added = head.filter((f) => (headCount.get(keyOf(f)) || 0) > (baseCount.get(keyOf(f)) || 0));
  const existing = head.filter((f) => !added.includes(f));
  const fixed = base.filter((f) => (baseCount.get(keyOf(f)) || 0) > (headCount.get(keyOf(f)) || 0));
  return { added, fixed, existing };
}

function code(s) {
  const t = s.length > 140 ? `${s.slice(0, 140)}…` : s;
  return t.includes("`") ? `\`\` ${t} \`\`` : `\`${t}\``;
}

function renderMarkdown({ errors, warnings, fixed, existing, points, combos, notes, hasDiff }) {
  const L = [MARKER, "## 自動チェック（簡易版）", ""];
  if (errors.length) L.push(`**❌ 直す必要があるものが ${errors.length} 件あります。** 直して push し直すと、もう一度チェックされます。`);
  else L.push("**✅ 読み込みを壊すような問題は見つかりませんでした。**");
  if (combos.length) L.push(`**🚨 アイテムを増やす処理と、貴重なアイテム・確率などが同じファイルにあります（${combos.length} ファイル）。** マージの前に、何が何倍になるかを確かめてください。`);
  if (points.length) L.push(`レビューで見てほしいところが ${points.reduce((n, p) => n + p.items.length, 0)} か所あります（下の ⚠️）。`);
  L.push("");

  if (combos.length) {
    L.push("### 🚨 特に見てほしいファイル", "", "アイテムを生み出す処理と、貴重なアイテム・確率・採掘・お金のどれかが、同じスクリプトに足されています。複製や入手量の増えすぎが起きやすい形です。", "");
    for (const c of combos) {
      L.push(`- **\`${c.file}\`**（${c.titles.join("・")}）`);
      for (const it of c.items.slice(0, 12)) L.push(`  - \`:${it.line}\` ${code(it.text)}`);
      if (c.items.length > 12) L.push(`  - ほか ${c.items.length - 12} 行`);
    }
    L.push("");
  }

  if (errors.length) {
    L.push("### ❌ エラー（マージの前に直す）", "");
    for (const f of errors) L.push(`- \`${f.file}:${f.line}\` ${f.message}`);
    L.push("");
  }
  if (warnings.length) {
    L.push("### ⚠️ コードの注意点", "");
    for (const f of warnings) L.push(`- \`${f.file}:${f.line}\` ${f.message}`);
    L.push("");
  }
  if (points.length) {
    L.push("### ⚠️ レビューで見てほしいところ", "", "この PR で足された行のうち、ゲームのバランスや安全に関わりやすいものです。問題があるとは限りません。意図どおりかを確かめてください。", "");
    for (const { rule, items } of points) {
      L.push(`<details${["valuable-item", "item-create", "money", "dynamic-command", "eval", "permission", "ci-change"].includes(rule.id) ? " open" : ""}><summary><b>${rule.title}</b>（${items.length} か所）— ${rule.why}</summary>`, "");
      for (const it of items.slice(0, MAX_HITS_PER_RULE)) L.push(`- \`${it.file}:${it.line}\` ${code(it.text)}`);
      if (items.length > MAX_HITS_PER_RULE) L.push(`- ほか ${items.length - MAX_HITS_PER_RULE} か所`);
      L.push("", "</details>", "");
    }
  }
  if (notes.length) {
    L.push("### ℹ️ メモ", "");
    for (const n of notes) L.push(`- ${n}`);
    L.push("");
  }
  if (fixed.length) {
    L.push(`<details><summary>この PR で直った問題（${fixed.length} 件）</summary>`, "");
    for (const f of fixed) L.push(`- \`${f.file}\` ${f.message}`);
    L.push("", "</details>", "");
  }
  if (existing.length) L.push(`<sub>前からある問題 ${existing.length} 件は、この PR のせいではないので数に入れていません。</sub>`, "");
  L.push(
    "<details><summary>このチェックについて</summary>",
    "",
    "- JSON が読めるか、JS の構文、import の行き先（大文字・小文字も）、エンティティのイベントとコンポーネントグループ、identifier の重複などを機械的に調べています。",
    "- 「レビューで見てほしいところ」は、足された行を `.github/cw-check/watch.json` の言葉で拾っているだけです。値が妥当か（倍率・確率・ドロップ数）は人が見てください。",
    "- ゲームの中での動きは確かめていません。デバッグ鯖（f/ ブランチ）で動かして、ログにエラーが出ていないかも見てください。",
    hasDiff ? "" : "- 差分が無かったので、レビューのポイントは出していません。",
    "",
    "</details>",
  );
  return L.filter((l, i, a) => !(l === "" && a[i - 1] === "")).join("\n");
}

function annotationEscape(s, prop) {
  let t = String(s).replace(/%/g, "%25").replace(/\r/g, "%0D").replace(/\n/g, "%0A");
  if (prop) t = t.replace(/:/g, "%3A").replace(/,/g, "%2C");
  return t;
}

// ---------------------------------------------------------------- 本体

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.head) {
    console.error("使い方: node check.mjs --head <dir> [--base <dir>] [--diff <file>] [--summary <file>] [--json <file>] [--annotate]");
    process.exit(2);
  }
  const watch = JSON.parse(fs.readFileSync(args.watch || path.join(HERE, "watch.json"), "utf8"));
  const head = scanPack(args.head);
  const base = args.base ? scanPack(args.base) : null;
  const { added, fixed, existing } = compare(head, base);
  const errors = added.filter((f) => f.level === "error");
  const warnings = added.filter((f) => f.level === "warning");

  const diffText = args.diff ? fs.readFileSync(args.diff, "utf8") : "";
  const diffFiles = diffText ? parseDiff(diffText) : [];
  const { groups: points, combos } = diffFiles.length ? reviewPoints(diffFiles, watch) : { groups: [], combos: [] };
  const notes = diffFiles.length ? notesFromDiff(diffFiles) : [];

  const md = renderMarkdown({ errors, warnings, fixed, existing, points, combos, notes, hasDiff: diffFiles.length > 0 });
  if (args.summary) fs.writeFileSync(args.summary, md);
  if (args.json) fs.writeFileSync(args.json, JSON.stringify({ errors, warnings, fixed, existing: existing.length, combos, points: points.map((p) => ({ id: p.rule.id, title: p.rule.title, items: p.items })), notes }, null, 2));

  if (args.annotate) {
    for (const f of errors) console.log(`::error file=${annotationEscape(f.file, true)},line=${f.line},title=${annotationEscape(f.rule, true)}::${annotationEscape(f.message)}`);
    for (const c of combos) console.log(`::warning file=${annotationEscape(c.file, true)},line=${c.items[0]?.line ?? 1},title=${annotationEscape("特に見てほしいファイル", true)}::${annotationEscape(`アイテムを増やす処理と、${c.titles.slice(1).join("・")}が同じファイルにあります。何が何倍になるかを確かめてください`)}`);
    for (const f of warnings) console.log(`::warning file=${annotationEscape(f.file, true)},line=${f.line},title=${annotationEscape(f.rule, true)}::${annotationEscape(f.message)}`);
    for (const { rule, items } of points) {
      for (const it of items.slice(0, MAX_HITS_PER_RULE)) {
        if (rule.id === "ci-change" || rule.id === "economy-files" || rule.id === "manifest") continue;
        console.log(`::notice file=${annotationEscape(it.file, true)},line=${it.line},title=${annotationEscape(rule.title, true)}::${annotationEscape(rule.why)}`);
      }
    }
  }
  console.log(`エラー ${errors.length} 件 / 注意 ${warnings.length} 件 / 特に見てほしいファイル ${combos.length} / レビューのポイント ${points.reduce((n, p) => n + p.items.length, 0)} か所 / 直った ${fixed.length} 件 / 前から ${existing.length} 件`);
  if (tmpDir) fs.rmSync(tmpDir, { recursive: true, force: true });
  process.exit(errors.length ? 1 : 0);
}

main();
