import { world, system } from "@minecraft/server";
import { record } from "./sender.js";
import { containerOf, contentsOf, diffContents, signTextOf } from "./util.js";

// チェストなどの出し入れと、看板の書き換えを記録する。
// 開いた（看板は置いた・触った）ときの中身を控え、閉じたとみなしたときの中身と比べる。
// 画面を閉じたことは Script API では分からないので、次のどれかで閉じたとみなす:
//   8 ブロックより離れた・別のディメンションに移った・抜けた・別のブロックを触った・壊した・置いた
// 開いたままのときは 5 分ごとに途中までの差を記録する。

const sessions = new Map(); // player.id → 開いているもの
const viewers = new Map(); // "dim|x,y,z" → Set(player.id)
const FAR_SQ = 8 * 8;
const FLUSH_TICKS = 20 * 60 * 5;
const NEIGHBORS = [
    { x: 0, y: 1, z: 0 },
    { x: 0, y: -1, z: 0 },
    { x: 1, y: 0, z: 0 },
    { x: -1, y: 0, z: 0 },
    { x: 0, y: 0, z: 1 },
    { x: 0, y: 0, z: -1 },
];
const AUTO_BLOCKS = new Set(["minecraft:hopper", "minecraft:dropper", "minecraft:crafter"]);

function hasAutoNeighbor(block) {
    for (const o of NEIGHBORS) {
        try {
            if (AUTO_BLOCKS.has(block.offset(o)?.typeId)) return true;
        } catch {
            // 読み込まれていない場所は見ない
        }
    }
    return false;
}

/**
 * @param {"open" | "sign"} kind
 * @param {{f: string, b: string}} [signBefore] 置いたばかりの看板は空から比べる
 */
export function startSession(player, block, kind, signBefore) {
    endSessionOf(player.id);
    const s = {
        player,
        pid: player.id,
        name: player.name,
        kind,
        typeId: block.typeId,
        dim: block.dimension.id,
        x: block.x,
        y: block.y,
        z: block.z,
        start: system.currentTick,
        recorded: false,
        shared: false,
        auto: false,
    };
    if (kind === "open") {
        const c = containerOf(block);
        if (!c) return;
        s.before = contentsOf(c);
        s.auto = hasAutoNeighbor(block);
    } else {
        s.before = signBefore ?? signTextOf(block) ?? { f: "", b: "" };
    }
    s.key = `${s.dim}|${s.x},${s.y},${s.z}`;
    let set = viewers.get(s.key);
    if (!set) viewers.set(s.key, (set = new Set()));
    set.add(s.pid);
    if (set.size > 1) {
        s.shared = true;
        for (const id of set) {
            const other = sessions.get(id);
            if (other) other.shared = true;
        }
    }
    sessions.set(s.pid, s);
}

function blockOf(s) {
    try {
        const b = world.getDimension(s.dim).getBlock({ x: s.x, y: s.y, z: s.z });
        return b && b.typeId === s.typeId ? b : undefined;
    } catch {
        return undefined;
    }
}

function base(s) {
    return { p: s.name, b: s.typeId, d: s.dim, x: s.x, y: s.y, z: s.z };
}

function flush(s, final) {
    const block = blockOf(s);
    if (s.kind === "sign") {
        if (!final || !block) return;
        const after = signTextOf(block);
        if (after && (after.f !== s.before.f || after.b !== s.before.b)) {
            record({ a: "Sign", ...base(s), e: { before: s.before, after } });
        }
        return;
    }
    if (!block) {
        if (final && !s.recorded) record({ a: "Open", ...base(s), e: { gone: 1 } });
        s.recorded = true;
        return;
    }
    const c = containerOf(block);
    if (!c) return;
    const now = contentsOf(c);
    const diff = diffContents(s.before, now);
    const changed = Object.keys(diff).length > 0;
    if (changed || (final && !s.recorded)) {
        const e = {};
        if (changed) e.diff = diff;
        if (s.shared) e.shared = 1;
        if (s.auto) e.auto = 1;
        record({ a: "Open", ...base(s), e: Object.keys(e).length > 0 ? e : undefined });
        s.recorded = true;
    }
    s.before = now;
    s.start = system.currentTick;
}

/** そのプレイヤーが開いているものを閉じたとみなして記録する */
export function endSessionOf(pid) {
    const s = sessions.get(pid);
    if (!s) return;
    sessions.delete(pid);
    const set = viewers.get(s.key);
    if (set) {
        set.delete(pid);
        if (set.size === 0) viewers.delete(s.key);
    }
    try {
        flush(s, true);
    } catch (e) {
        console.warn(`[BlockLogger] 出し入れの記録に失敗しました: ${e}`);
    }
}

system.runInterval(() => {
    if (sessions.size === 0) return;
    for (const [pid, s] of sessions) {
        let far = true;
        try {
            const p = s.player;
            if (p.isValid) {
                const l = p.location;
                far = p.dimension.id !== s.dim || (l.x - s.x - 0.5) ** 2 + (l.y - s.y - 0.5) ** 2 + (l.z - s.z - 0.5) ** 2 > FAR_SQ;
            }
        } catch {
            far = true;
        }
        if (far) {
            endSessionOf(pid);
        } else if (system.currentTick - s.start >= FLUSH_TICKS) {
            try {
                flush(s, false);
            } catch {
                // 次の機会に記録する
            }
        }
    }
}, 10);
