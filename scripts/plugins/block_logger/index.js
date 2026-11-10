import { world, system } from "@minecraft/server";
import { record } from "./sender.js";
import { containerOf, contentsOf, isSignBlock, signTextOf } from "./util.js";
import { startSession, endSessionOf } from "./containers.js";
import { isInspecting } from "./inspect.js";

// ブロックログの記録。送るのは sender.js（1 秒ごとにまとめて送る）。
//   Break   … 本当に壊れたときだけ（中身・看板の文字・状態も）
//   Place   … 置いたブロック（状態も）
//   Open    … チェストなどの出し入れ（containers.js）
//   Sign    … 看板の書き換え（containers.js）
//   Explode … 爆発で消えたブロック（名前は "#tnt" など爆発の元）
//   Use     … 溶岩・水などのバケツ、火打石、ファイヤーチャージ
//   Kill    … ペット・村人・馬などを倒した
//   Denied  … 土地やチェストの保護で止められた操作（同じ人・同じチャンク・同じ操作は 30 秒に 1 件）
//   Pos     … 1 分ごとの居場所（受け側では別の表）

const statesOf = (perm) => {
    try {
        const s = perm.getAllStates();
        return Object.keys(s).length > 0 ? s : undefined;
    } catch {
        return undefined;
    }
};

/** undefined の項目を落とす。何も残らなければ undefined */
const extra = (o) => {
    for (const k of Object.keys(o)) if (o[k] === undefined) delete o[k];
    return Object.keys(o).length > 0 ? o : undefined;
};

// ---------- 未遂（保護などで止められたもの） ----------
// before イベントのあと 2 tick たっても after イベントが来なければ、止められたとみなす。
const deniedSeen = new Map();

function denied(name, kind, typeId, dim, x, y, z) {
    const key = `${name}|${kind}|${dim}|${x >> 4},${z >> 4}`;
    const now = Date.now();
    const seen = deniedSeen.get(key);
    if (seen && now - seen.last < 30000) {
        seen.n++;
        return;
    }
    record({ a: "Denied", p: name, b: typeId, d: dim, x, y, z, e: { k: kind, n: (seen?.n ?? 0) + 1 } });
    deniedSeen.set(key, { last: now, n: 0 });
}

system.runInterval(() => {
    const now = Date.now();
    for (const [k, v] of deniedSeen) if (now - v.last > 60000) deniedSeen.delete(k);
}, 1200);

// ---------- 破壊 ----------
const pendingBreaks = new Map();

world.beforeEvents.playerBreakBlock.subscribe((ev) => {
    const { player, block } = ev;
    if (isInspecting(player)) return;
    const name = player.name;
    const dim = block.dimension.id;
    const { x, y, z } = block;
    const key = `${player.id}|${dim}|${x},${y},${z}`;
    const snap = { typeId: block.typeId };
    const c = containerOf(block);
    if (c) {
        try {
            const items = contentsOf(c);
            if (Object.keys(items).length > 0) snap.c = items;
        } catch {
            // 中身が読めなくても破壊は記録する
        }
    }
    const sign = signTextOf(block);
    if (sign && (sign.f || sign.b)) snap.sign = sign;
    pendingBreaks.set(key, snap);
    system.runTimeout(() => {
        if (pendingBreaks.get(key) !== snap) return;
        pendingBreaks.delete(key);
        denied(name, "break", snap.typeId, dim, x, y, z);
    }, 2);
});

world.afterEvents.playerBreakBlock.subscribe((ev) => {
    const { player, block, brokenBlockPermutation: perm } = ev;
    const dim = block.dimension.id;
    const { x, y, z } = block;
    const key = `${player.id}|${dim}|${x},${y},${z}`;
    const snap = pendingBreaks.get(key);
    pendingBreaks.delete(key);
    endSessionOf(player.id);
    record({ a: "Break", p: player.name, b: perm.type.id, d: dim, x, y, z, e: extra({ s: statesOf(perm), c: snap?.c, sign: snap?.sign }) });
});

// ---------- 設置 ----------
// 置く場所は before と after で同じとは限らない（ドア・ベッドなど）ので、プレイヤーごとに見る
const pendingPlaces = new Map();

world.beforeEvents.playerPlaceBlock.subscribe((ev) => {
    const { player, block } = ev;
    if (isInspecting(player)) return;
    const pid = player.id;
    const name = player.name;
    const dim = block.dimension.id;
    const { x, y, z } = block;
    let typeId = "unknown";
    try {
        typeId = ev.permutationToPlace?.type?.id ?? typeId;
    } catch {
        // 種類が分からなくても未遂は残す
    }
    const token = {};
    pendingPlaces.set(pid, token);
    system.runTimeout(() => {
        if (pendingPlaces.get(pid) !== token) return;
        pendingPlaces.delete(pid);
        denied(name, "place", typeId, dim, x, y, z);
    }, 2);
});

world.afterEvents.playerPlaceBlock.subscribe((ev) => {
    const { player, block } = ev;
    pendingPlaces.delete(player.id);
    endSessionOf(player.id);
    record({ a: "Place", p: player.name, b: block.typeId, d: block.dimension.id, x: block.x, y: block.y, z: block.z, e: extra({ s: statesOf(block.permutation) }) });
    // 置いた看板は、そのあと書いた文字を記録する
    if (isSignBlock(block)) startSession(player, block, "sign", { f: "", b: "" });
});

// ---------- 開ける・バケツと火 ----------
const USE_ITEMS = new Set([
    "minecraft:lava_bucket",
    "minecraft:water_bucket",
    "minecraft:powder_snow_bucket",
    "minecraft:cod_bucket",
    "minecraft:salmon_bucket",
    "minecraft:pufferfish_bucket",
    "minecraft:tropical_fish_bucket",
    "minecraft:axolotl_bucket",
    "minecraft:tadpole_bucket",
    "minecraft:flint_and_steel",
    "minecraft:fire_charge",
]);

const FACE = {
    Up: { x: 0, y: 1, z: 0 },
    Down: { x: 0, y: -1, z: 0 },
    North: { x: 0, y: 0, z: -1 },
    South: { x: 0, y: 0, z: 1 },
    East: { x: 1, y: 0, z: 0 },
    West: { x: -1, y: 0, z: 0 },
};

/** バケツや火が実際に入る場所（液体や TNT を触ったときはそのもの、ほかは触った面の先） */
function useTarget(block, face, item) {
    let self = block.typeId === "minecraft:tnt";
    if (item.endsWith("_bucket")) {
        try {
            self = self || block.isLiquid || block.isWaterlogged;
        } catch {
            // 分からなければ面の先とする
        }
    }
    const o = self ? { x: 0, y: 0, z: 0 } : FACE[face] ?? { x: 0, y: 0, z: 0 };
    return { x: block.x + o.x, y: block.y + o.y, z: block.z + o.z };
}

const pendingInteract = new Map();

world.beforeEvents.playerInteractWithBlock.subscribe((ev) => {
    if (!ev.isFirstEvent) return;
    const { player, block, itemStack } = ev;
    if (isInspecting(player)) return;
    const item = itemStack?.typeId;
    let kind;
    if (item && USE_ITEMS.has(item)) kind = "use";
    // しゃがんで触るのは、チェスト保護の設定画面（保護側が開くのを止める）か、横に置く操作なので数えない
    else if (!player.isSneaking && (containerOf(block) || isSignBlock(block))) kind = "open";
    else return;
    const pid = player.id;
    const name = player.name;
    const dim = block.dimension.id;
    const { x, y, z } = block;
    const typeId = kind === "use" ? item : block.typeId;
    const token = {};
    pendingInteract.set(pid, token);
    system.runTimeout(() => {
        if (pendingInteract.get(pid) !== token) return;
        pendingInteract.delete(pid);
        denied(name, kind, typeId, dim, x, y, z);
    }, 2);
});

world.afterEvents.playerInteractWithBlock.subscribe((ev) => {
    if (!ev.isFirstEvent) return;
    const { player, block } = ev;
    pendingInteract.delete(player.id);
    const item = ev.beforeItemStack?.typeId;
    if (item && USE_ITEMS.has(item)) {
        const t = useTarget(block, ev.blockFace, item);
        record({ a: "Use", p: player.name, b: item, d: block.dimension.id, ...t, e: { on: block.typeId } });
        return;
    }
    if (containerOf(block)) startSession(player, block, "open");
    else if (isSignBlock(block)) startSession(player, block, "sign");
});

// ---------- 爆発 ----------
world.afterEvents.blockExplode.subscribe((ev) => {
    const { block, explodedBlockPermutation: perm, source } = ev;
    let who = "#unknown";
    try {
        if (source) who = source.typeId === "minecraft:player" ? source.name : "#" + source.typeId.replace(/^minecraft:/, "");
    } catch {
        // 爆発の元が消えていることがある
    }
    record({ a: "Explode", p: who, b: perm.type.id, d: block.dimension.id, x: block.x, y: block.y, z: block.z, e: extra({ s: statesOf(perm) }) });
});

// ---------- 倒した ----------
const KILL_TYPES = new Set([
    "minecraft:villager",
    "minecraft:villager_v2",
    "minecraft:wandering_trader",
    "minecraft:iron_golem",
    "minecraft:snow_golem",
    "minecraft:horse",
    "minecraft:donkey",
    "minecraft:mule",
    "minecraft:skeleton_horse",
    "minecraft:llama",
    "minecraft:trader_llama",
    "minecraft:camel",
    "minecraft:wolf",
    "minecraft:cat",
    "minecraft:parrot",
    "minecraft:allay",
    "minecraft:axolotl",
    "minecraft:sniffer",
    "minecraft:armor_stand",
]);

world.afterEvents.entityDie.subscribe((ev) => {
    const killer = ev.damageSource?.damagingEntity;
    if (killer?.typeId !== "minecraft:player") return;
    const v = ev.deadEntity;
    try {
        const typeId = v.typeId;
        if (typeId === "minecraft:player") return;
        let n;
        let tamed = false;
        try {
            n = v.nameTag || undefined;
        } catch {
            n = undefined;
        }
        try {
            tamed = !!(v.getComponent("minecraft:tameable")?.isTamed || v.getComponent("minecraft:tamemount")?.isTamed);
        } catch {
            tamed = false;
        }
        if (!KILL_TYPES.has(typeId) && !n && !tamed) return;
        const l = v.location;
        record({
            a: "Kill",
            p: killer.name,
            b: typeId,
            d: v.dimension.id,
            x: Math.floor(l.x),
            y: Math.floor(l.y),
            z: Math.floor(l.z),
            e: extra({ n: n ? String(n).slice(0, 64) : undefined, tamed: tamed ? 1 : undefined }),
        });
    } catch {
        // 消えかけのエンティティは読めないことがある
    }
});

// ---------- 居場所（1 分ごと） ----------
system.runInterval(() => {
    for (const p of world.getAllPlayers()) {
        try {
            const l = p.location;
            record({ a: "Pos", p: p.name, d: p.dimension.id, x: Math.floor(l.x), y: Math.floor(l.y), z: Math.floor(l.z) });
        } catch {
            // 入りかけ・抜けかけの人は飛ばす
        }
    }
}, 1200);
