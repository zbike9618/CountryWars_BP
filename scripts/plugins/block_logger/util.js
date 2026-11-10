import { SignSide } from "@minecraft/server";

// ブロックログで共通に使うもの（記録の種類の名前、中身の数え方、表示の整え方）

export const ACTION_LABEL = {
    Break: "破壊",
    Place: "設置",
    Open: "中身",
    Sign: "看板",
    Explode: "爆発",
    Use: "使用",
    Kill: "討伐",
    Denied: "未遂",
};

export const ACTION_COLOR = {
    Break: "§c",
    Place: "§a",
    Open: "§e",
    Sign: "§d",
    Explode: "§6",
    Use: "§9",
    Kill: "§4",
    Denied: "§8",
};

const DENIED_LABEL = { break: "破壊", place: "設置", open: "開ける", use: "使用" };

export const short = (id) => (typeof id === "string" ? id.replace(/^minecraft:/, "") : String(id));

export function containerOf(block) {
    try {
        return block.getComponent("minecraft:inventory")?.container;
    } catch {
        return undefined;
    }
}

export function isSignBlock(block) {
    try {
        return !!block.getComponent("minecraft:sign");
    } catch {
        return false;
    }
}

/** 入れ物の中身を { アイテムID: 個数 } にまとめる */
export function contentsOf(container) {
    const out = {};
    for (let i = 0; i < container.size; i++) {
        const item = container.getItem(i);
        if (item) out[item.typeId] = (out[item.typeId] ?? 0) + item.amount;
    }
    return out;
}

/** 中身の増減（増えたら +、減ったら -）。変わらないものは入れない */
export function diffContents(before, after) {
    const diff = {};
    for (const id of new Set([...Object.keys(before), ...Object.keys(after)])) {
        const d = (after[id] ?? 0) - (before[id] ?? 0);
        if (d !== 0) diff[id] = d;
    }
    return diff;
}

/** 看板の文字（表 f・裏 b）。看板でなければ undefined */
export function signTextOf(block) {
    let sign;
    try {
        sign = block.getComponent("minecraft:sign");
    } catch {
        return undefined;
    }
    if (!sign) return undefined;
    const cut = (s) => (typeof s === "string" ? s.slice(0, 200) : "");
    try {
        return { f: cut(sign.getText(SignSide.Front)), b: cut(sign.getText(SignSide.Back)) };
    } catch {
        return undefined;
    }
}

// ---------- 表示 ----------

/** "2026-11-10 12:01:21" → "11/10 12:01" */
export function shortTime(ts) {
    if (typeof ts !== "string" || ts.length < 16) return String(ts);
    return `${ts.substring(5, 10).replace("-", "/")} ${ts.substring(11, 16)}`;
}

const oneLine = (s) => String(s ?? "").replace(/\s*\n\s*/g, " / ").slice(0, 60);

/** { id: 個数 } → "§a+diamond×3 §c-iron_ingot×10" */
export function formatItems(map, max = 6) {
    const entries = Object.entries(map ?? {}).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));
    const parts = entries.slice(0, max).map(([id, n]) => `${n > 0 ? "§a+" : "§c"}${n > 0 ? "" : "-"}${short(id)}×${Math.abs(n)}`);
    if (entries.length > max) parts.push(`§7ほか${entries.length - max}種類`);
    return parts.join(" ");
}

/** 中身（個数だけ、+- なし） */
function formatHeld(map, max = 6) {
    const entries = Object.entries(map ?? {}).sort((a, b) => b[1] - a[1]);
    const parts = entries.slice(0, max).map(([id, n]) => `${short(id)}×${n}`);
    if (entries.length > max) parts.push(`ほか${entries.length - max}種類`);
    return parts.join(" ");
}

/** 記録の付け足し部分を短く（チャット・ボタン用） */
export function extraSummary(row) {
    const e = row.extra;
    if (!e) return row.action === "Open" ? " §7（見ただけ）" : "";
    switch (row.action) {
        case "Break": {
            let s = "";
            if (e.c) s += ` §7中身: ${formatHeld(e.c, 3)}`;
            if (e.sign && (e.sign.f || e.sign.b)) s += ` §7「${oneLine(e.sign.f || e.sign.b)}§r§7」`;
            return s;
        }
        case "Open": {
            let s = e.diff ? ` ${formatItems(e.diff, 3)}` : e.gone ? " §8（開いている間に壊れた）" : " §7（見ただけ）";
            if (e.shared) s += " §c同時に開いた人あり";
            if (e.auto) s += " §8ホッパーあり";
            return s;
        }
        case "Sign":
            return ` §7「${oneLine(e.before?.f)}§r§7」→「${oneLine(e.after?.f)}§r§7」`;
        case "Denied":
            return ` §8（${DENIED_LABEL[e.k] ?? e.k ?? "?"}${e.n > 1 ? ` ×${e.n}` : ""}）`;
        case "Kill":
            return (e.n ? ` §7「${oneLine(e.n)}§r§7」` : "") + (e.tamed ? " §7飼われていた" : "");
        case "Use":
            return e.on ? ` §7（${short(e.on)} に）` : "";
        default:
            return "";
    }
}

/** チャット1行 */
export function rowLine(row, withPos = false) {
    const color = ACTION_COLOR[row.action] ?? "§f";
    const label = ACTION_LABEL[row.action] ?? row.action;
    const pos = withPos ? ` §8(${row.x}, ${row.y}, ${row.z})` : "";
    return `§7${shortTime(row.timestamp)} ${color}${label} §f${row.playerName} §7${short(row.blockName)}${extraSummary(row)}${pos}`;
}

/** 詳細画面の本文 */
export function rowDetail(row) {
    const e = row.extra ?? {};
    const color = ACTION_COLOR[row.action] ?? "§f";
    const lines = [
        `§7時刻:§r ${row.timestamp}`,
        `§7プレイヤー:§r §b${row.playerName}§r`,
        `§7種類:§r ${color}${ACTION_LABEL[row.action] ?? row.action}§r`,
        `§7ブロック・アイテム:§r ${short(row.blockName)}`,
        `§7座標:§r [${row.x}, ${row.y}, ${row.z}] ${short(row.dimension)}`,
    ];
    if (row.action === "Break" && e.c) lines.push(`§7壊したときの中身:§r ${formatHeld(e.c, 30)}`);
    if (row.action === "Break" && e.sign) lines.push(`§7看板の文字:§r 「${e.sign.f}§r」 裏「${e.sign.b}§r」`);
    if (row.action === "Open") {
        lines.push(e.diff ? `§7出し入れ（+ 入れた / - 取った）:§r ${formatItems(e.diff, 30)}` :e.gone ? "§7開いている間に壊れた・入れ替わった" : "§7出し入れなし（見ただけ）");
        if (e.shared) lines.push("§c同じ時に別の人も開いていた（どちらが動かしたかは分からない）");
        if (e.auto) lines.push("§8ホッパーなどにつながっている（その出入りも数に入る）");
    }
    if (row.action === "Sign") lines.push(`§7前:§r 「${e.before?.f ?? ""}§r」 裏「${e.before?.b ?? ""}§r」`, `§7後:§r 「${e.after?.f ?? ""}§r」 裏「${e.after?.b ?? ""}§r」`);
    if (row.action === "Denied") lines.push(`§7止められた操作:§r ${DENIED_LABEL[e.k] ?? e.k ?? "?"}（30秒で ${e.n ?? 1} 回）`);
    if (row.action === "Kill") {
        if (e.n) lines.push(`§7名前:§r ${e.n}`);
        if (e.tamed) lines.push("§7飼われていた");
    }
    if (row.action === "Use" && e.on) lines.push(`§7使った先:§r ${short(e.on)}`);
    if (row.action === "Explode") lines.push("§7爆発の元:§r " + row.playerName.replace(/^#/, ""));
    if (e.s) lines.push(`§8状態: ${JSON.stringify(e.s).slice(0, 200)}`);
    return lines.join("\n");
}
