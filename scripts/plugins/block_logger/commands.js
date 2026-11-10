import * as server from "@minecraft/server";
import { ActionFormData, ModalFormData } from "@minecraft/server-ui";
import { query } from "./sender.js";
import { ACTION_COLOR, ACTION_LABEL, rowDetail, rowLine, short, shortTime, extraSummary } from "./util.js";
import { toggleInspect, isInspecting } from "./inspect.js";

const { world, system } = server;

// /cw:blocklog … ブロックログを調べる画面（周辺・人・その場にいた人・調査モード）
// /cw:inspect  … 調査モードの切り替え

system.beforeEvents.startup.subscribe((ev) => {
    ev.customCommandRegistry.registerCommand(
        {
            name: "cw:blocklog",
            description: "ブロックログを調べる（周辺・人・その場にいた人・調査モード）",
            permissionLevel: server.CommandPermissionLevel.Admin,
            optionalParameters: [{ name: "radius", type: server.CustomCommandParamType.Integer }],
        },
        (origin, radius) => {
            const player = origin.sourceEntity;
            if (player?.typeId !== "minecraft:player") {
                console.warn("このコマンドはプレイヤーのみ実行可能です");
                return;
            }
            system.run(() => (radius !== undefined ? areaSearch(player, { radius }) : mainMenu(player)));
        }
    );
    ev.customCommandRegistry.registerCommand(
        {
            name: "cw:inspect",
            description: "調査モードを切り替える（叩いた・右クリックした場所のブロックログを出す）",
            permissionLevel: server.CommandPermissionLevel.Admin,
        },
        (origin) => {
            const player = origin.sourceEntity;
            if (player?.typeId !== "minecraft:player") return;
            system.run(() => toggleInspect(player));
        }
    );
});

/** チャットを開いていて「UserBusy」で開けないときは、開けるまで少し待って出し直す */
async function forceShow(player, form) {
    for (let i = 0; i < 200; i++) {
        const res = await form.show(player);
        if (res.cancelationReason !== "UserBusy") return res;
        await new Promise((resolve) => system.run(resolve));
    }
    return { canceled: true };
}

const KINDS = [
    ["すべて", []],
    ["破壊・設置", ["Break", "Place"]],
    ["破壊だけ", ["Break"]],
    ["チェストなどの出し入れ", ["Open"]],
    ["看板の書き換え", ["Sign"]],
    ["爆発", ["Explode"]],
    ["バケツ・火", ["Use"]],
    ["動物・村人などを倒した", ["Kill"]],
    ["未遂（保護で止められた）", ["Denied"]],
];
const PERIODS = [
    ["全期間", 0],
    ["1時間", 1 / 24],
    ["6時間", 0.25],
    ["1日", 1],
    ["3日", 3],
    ["1週間", 7],
    ["2週間", 14],
    ["1か月", 30],
];
const NEAR_RADIUS = [16, 32, 64, 128, 256];
const NEAR_HOURS = [
    ["1時間", 1],
    ["3時間", 3],
    ["6時間", 6],
    ["1日", 24],
    ["3日", 72],
    ["1週間", 168],
    ["1か月", 720],
];

const here = (player) => {
    const l = player.location;
    return { x: Math.floor(l.x), y: Math.floor(l.y), z: Math.floor(l.z), dimension: player.dimension.id };
};

async function mainMenu(player) {
    const form = new ActionFormData()
        .title("§eブロックログ§r")
        .body("調べ方を選んでください。")
        .button("この周りを調べる")
        .button("プレイヤーで調べる")
        .button("この周りにいた人")
        .button(isInspecting(player) ? "調査モードを OFF にする" : "調査モードを ON にする\n§8叩いた場所の履歴を出す");
    const res = await forceShow(player, form);
    if (res.canceled) return;
    if (res.selection === 0) return areaSearch(player, {});
    if (res.selection === 1) return playerSearch(player);
    if (res.selection === 2) return nearbySearch(player);
    if (res.selection === 3) return toggleInspect(player);
}

// ---------- この周り ----------
async function areaSearch(player, pre) {
    const form = new ModalFormData()
        .title("§eこの周りを調べる§r")
        .slider("半径 (マス)", 1, 32, { defaultValue: Math.min(32, Math.max(1, pre.radius ?? 8)) })
        .dropdown("期間", PERIODS.map((p) => p[0]), { defaultValueIndex: 0 })
        .dropdown("種類", KINDS.map((k) => k[0]), { defaultValueIndex: 0 })
        .textField("プレイヤー名（空なら全員。名前は正確に）", "例: Steve", { defaultValue: "" });
    const res = await forceShow(player, form);
    if (res.canceled) return;
    const [radius, periodIndex, kindIndex, name] = res.formValues;
    const cond = {
        ...here(player),
        radius,
        days: PERIODS[periodIndex][1],
        actions: KINDS[kindIndex][1],
        player: String(name ?? "").trim() || undefined,
        limit: 500,
    };
    const title = `半径${radius}・${PERIODS[periodIndex][0]}・${KINDS[kindIndex][0]}${cond.player ? `・${cond.player}` : ""}`;
    player.sendMessage(`§e[ブロックログ] 検索中…（${title}）`);
    let rows;
    try {
        rows = await query("/block-log-viewer", cond);
    } catch (e) {
        player.sendMessage(`§c[ブロックログ] 取得できませんでした: ${e}`);
        return;
    }
    return showList(player, rows, 0, { title, again: () => areaSearch(player, { radius }), withPos: false });
}

// ---------- プレイヤー ----------
async function playerSearch(player, preName) {
    const online = world
        .getAllPlayers()
        .map((p) => p.name)
        .sort();
    const form = new ModalFormData()
        .title("§eプレイヤーで調べる§r")
        .dropdown("いま入っている人から選ぶ", ["（下に入力した名前）", ...online], { defaultValueIndex: 0 })
        .textField("名前（一部でもよい）", "例: Steve", { defaultValue: preName ?? "" })
        .dropdown("期間", PERIODS.map((p) => p[0]), { defaultValueIndex: 3 })
        .dropdown("種類", KINDS.map((k) => k[0]), { defaultValueIndex: 0 });
    const res = await forceShow(player, form);
    if (res.canceled) return;
    const [onlineIndex, typed, periodIndex, kindIndex] = res.formValues;
    let name = onlineIndex > 0 ? online[onlineIndex - 1] : String(typed ?? "").trim();
    if (!name) {
        player.sendMessage("§c[ブロックログ] 名前を入れてください");
        return;
    }
    if (onlineIndex === 0) {
        name = await resolveName(player, name);
        if (!name) return;
    }
    return runPlayerSearch(player, name, PERIODS[periodIndex], KINDS[kindIndex]);
}

/** 入力した名前（一部）から、記録にある名前を 1 つ選ぶ */
async function resolveName(player, typed) {
    let rows;
    try {
        rows = await query("/block-log/players", { q: typed });
    } catch (e) {
        player.sendMessage(`§c[ブロックログ] 名前を調べられませんでした: ${e}`);
        return undefined;
    }
    const exact = rows.find((r) => r.name.toLowerCase() === typed.toLowerCase());
    if (exact) return exact.name;
    if (rows.length === 0) {
        player.sendMessage(`§c[ブロックログ] 「${typed}」に合う名前は記録にありません`);
        return undefined;
    }
    if (rows.length === 1) return rows[0].name;
    const form = new ActionFormData().title("§e名前を選ぶ§r").body(`「${typed}」を含む名前（最後に記録がある順）`);
    for (const r of rows) form.button(`${r.name}\n§8最後: ${shortTime(r.lastSeen)}`);
    const res = await forceShow(player, form);
    if (res.canceled) return undefined;
    return rows[res.selection].name;
}

async function runPlayerSearch(player, name, period, kind) {
    const title = `${name}・${period[0]}・${kind[0]}`;
    player.sendMessage(`§e[ブロックログ] 検索中…（${title}）`);
    let rows;
    try {
        rows = await query("/block-log/player", { player: name, days: period[1], actions: kind[1], limit: 500 });
    } catch (e) {
        player.sendMessage(`§c[ブロックログ] 取得できませんでした: ${e}`);
        return;
    }
    return showList(player, rows, 0, { title, again: () => playerSearch(player, name), withPos: true });
}

// ---------- この周りにいた人 ----------
async function nearbySearch(player) {
    const form = new ModalFormData()
        .title("§eこの周りにいた人§r")
        .dropdown("半径 (マス)", NEAR_RADIUS.map(String), { defaultValueIndex: 1 })
        .dropdown("どのくらい前まで", NEAR_HOURS.map((h) => h[0]), { defaultValueIndex: 3 });
    const res = await forceShow(player, form);
    if (res.canceled) return;
    const [ri, hi] = res.formValues;
    const at = here(player);
    let data;
    try {
        data = await query("/block-log/nearby", { ...at, radius: NEAR_RADIUS[ri], hours: NEAR_HOURS[hi][1] });
    } catch (e) {
        player.sendMessage(`§c[ブロックログ] 取得できませんでした: ${e}`);
        return;
    }
    const people = new Map();
    for (const p of data.positions) people.set(p.playerName, { name: p.playerName, last: p.last, first: p.first, samples: p.samples });
    for (const a of data.actions) {
        const cur = people.get(a.playerName) ?? { name: a.playerName, last: a.last, first: a.first, samples: 0 };
        cur.events = a.events;
        cur.breaks = a.breaks;
        cur.places = a.places;
        cur.opens = a.opens;
        cur.denied = a.denied;
        if (a.last > cur.last) cur.last = a.last;
        if (a.first < cur.first) cur.first = a.first;
        people.set(a.playerName, cur);
    }
    const list = [...people.values()].sort((a, b) => (a.last < b.last ? 1 : -1));
    const form2 = new ActionFormData()
        .title("§eこの周りにいた人§r")
        .body(
            `(${at.x}, ${at.z}) の半径${data.radius}・${NEAR_HOURS[hi][0]}以内。\n` +
                "§7居場所は 1 分ごとの記録（入れ替えた日より前は無い）。爆発の元は # で始まる。§r\n" +
                (list.length === 0 ? "\n§7だれもいませんでした" : "")
        );
    for (const p of list) {
        const parts = [];
        if (p.samples) parts.push(`いた ${p.samples}分`);
        if (p.breaks) parts.push(`破壊${p.breaks}`);
        if (p.places) parts.push(`設置${p.places}`);
        if (p.opens) parts.push(`中身${p.opens}`);
        if (p.denied) parts.push(`§c未遂${p.denied}§8`);
        form2.button(`${p.name}\n§8${shortTime(p.first)}〜${shortTime(p.last)} ${parts.join(" ")}`);
    }
    form2.button("§e条件を変えて調べる");
    const res2 = await forceShow(player, form2);
    if (res2.canceled) return;
    if (res2.selection === list.length) return nearbySearch(player);
    const who = list[res2.selection].name;
    if (who.startsWith("#")) return;
    // 選んだ時間を含む一番短い期間で、その人の記録を出す
    const hours = NEAR_HOURS[hi][1];
    const period = PERIODS.find((p) => p[1] > 0 && p[1] * 24 >= hours) ?? PERIODS[0];
    return runPlayerSearch(player, who, period, KINDS[0]);
}

// ---------- 一覧と詳細 ----------
const PER_PAGE = 15;

async function showList(player, rows, page, ctx) {
    if (rows.length === 0) {
        const empty = new ActionFormData()
            .title("§e検索結果§r")
            .body(`§7見つかりませんでした。§r\n§7(${ctx.title})`)
            .button("条件を変えて調べる")
            .button("閉じる");
        const r = await forceShow(player, empty);
        if (r.selection === 0) return ctx.again();
        return;
    }
    const pages = Math.ceil(rows.length / PER_PAGE);
    const start = page * PER_PAGE;
    const pageRows = rows.slice(start, start + PER_PAGE);
    const form = new ActionFormData()
        .title(`§e検索結果 (${page + 1}/${pages})§r`)
        .body(`${ctx.title}\n新しい順に ${rows.length} 件${rows.length >= 500 ? "（多いので 500 件まで。期間や種類で絞る）" : ""}`);
    const acts = [];
    if (page > 0) {
        form.button("§b◀ 前のページへ");
        acts.push(() => showList(player, rows, page - 1, ctx));
    }
    pageRows.forEach((r, i) => {
        const color = ACTION_COLOR[r.action] ?? "§f";
        const pos = ctx.withPos ? ` §8(${r.x},${r.y},${r.z})` : "";
        form.button(`${color}[${shortTime(r.timestamp)}] ${ACTION_LABEL[r.action] ?? r.action} §0${r.playerName}\n§8${short(r.blockName)}${pos}${stripForButton(extraSummary(r))}`);
        acts.push(() => showDetail(player, rows, start + i, page, ctx));
    });
    if (page < pages - 1) {
        form.button("§b次のページへ ▶");
        acts.push(() => showList(player, rows, page + 1, ctx));
    }
    form.button("§2チャットに書き出す（このページ）");
    acts.push(() => {
        player.sendMessage([`§7--- ${ctx.title} (${page + 1}/${pages}) ---`, ...pageRows.map((r) => rowLine(r, true))].join("\n"));
    });
    form.button("§e条件を変えて調べる");
    acts.push(() => ctx.again());
    const res = await forceShow(player, form);
    if (res.canceled) return;
    return acts[res.selection]();
}

/** ボタンは 2 行までなので、付け足しは短く・色は暗くする */
function stripForButton(s) {
    const t = s.replace(/§./g, "").trim();
    return t ? ` ${t.slice(0, 40)}` : "";
}

async function showDetail(player, rows, index, page, ctx) {
    const r = rows[index];
    const form = new ActionFormData().title("§eログの詳細§r").body(rowDetail(r)).button("戻る").button("この場所へ移動").button("閉じる");
    const res = await forceShow(player, form);
    if (res.canceled || res.selection === 2) return;
    if (res.selection === 0) return showList(player, rows, page, ctx);
    try {
        player.teleport({ x: r.x + 0.5, y: r.y + 1, z: r.z + 0.5 }, { dimension: world.getDimension(r.dimension) });
    } catch (e) {
        player.sendMessage(`§c[ブロックログ] 移動できませんでした: ${e}`);
    }
}
