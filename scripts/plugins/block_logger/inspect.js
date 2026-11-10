import { world, system } from "@minecraft/server";
import { query } from "./sender.js";
import { containerOf, isSignBlock, rowLine } from "./util.js";

// 調査モード: ON の間は、叩いたブロック・右クリックした面の先の履歴をチャットに出す。
// その間は壊す・置く・開くができない（記録もしない）。抜けると OFF に戻る。

const inspectors = new Set();
const lastAsk = new Map();

const FACE = {
    Up: { x: 0, y: 1, z: 0 },
    Down: { x: 0, y: -1, z: 0 },
    North: { x: 0, y: 0, z: -1 },
    South: { x: 0, y: 0, z: 1 },
    East: { x: 1, y: 0, z: 0 },
    West: { x: -1, y: 0, z: 0 },
};

export const isInspecting = (player) => inspectors.has(player.id);

export function toggleInspect(player) {
    if (inspectors.has(player.id)) {
        inspectors.delete(player.id);
        player.sendMessage("§e[ブロックログ] 調査モードを OFF にしました");
    } else {
        inspectors.add(player.id);
        player.sendMessage(
            "§e[ブロックログ] 調査モードを ON にしました。\n" +
                "§7・叩く: そのブロックの履歴\n" +
                "§7・右クリック: 触った面の先（壊されて空気になった場所など）の履歴。チェスト・看板はそのものの履歴\n" +
                "§7・この間は壊す・置く・開くができません。もう一度 /cw:inspect で OFF"
        );
    }
}

world.afterEvents.playerLeave.subscribe((ev) => {
    inspectors.delete(ev.playerId);
    lastAsk.delete(ev.playerId);
});

async function show(player, dim, loc, title) {
    const now = system.currentTick;
    if (now - (lastAsk.get(player.id) ?? -100) < 10) return;
    lastAsk.set(player.id, now);
    try {
        const rows = await query("/block-log/at", { dimension: dim, x: loc.x, y: loc.y, z: loc.z, limit: 10 });
        if (!player.isValid) return;
        const lines = [`§7--- ${title} (${loc.x}, ${loc.y}, ${loc.z}) 新しい順 ---`];
        if (rows.length === 0) lines.push("§7記録はありません");
        for (const r of rows) lines.push(rowLine(r));
        if (rows.length === 10) lines.push("§8もっと前は /cw:blocklog で調べる");
        player.sendMessage(lines.join("\n"));
    } catch (e) {
        if (player.isValid) player.sendMessage(`§c[ブロックログ] 取得できませんでした: ${e}`);
    }
}

world.beforeEvents.playerBreakBlock.subscribe((ev) => {
    if (!inspectors.has(ev.player.id)) return;
    ev.cancel = true;
    const { player, block } = ev;
    const dim = block.dimension.id;
    const loc = { x: block.x, y: block.y, z: block.z };
    system.run(() => show(player, dim, loc, "このブロック"));
});

world.beforeEvents.playerInteractWithBlock.subscribe((ev) => {
    if (!inspectors.has(ev.player.id)) return;
    ev.cancel = true;
    if (!ev.isFirstEvent) return;
    const { player, block } = ev;
    const dim = block.dimension.id;
    const self = containerOf(block) || isSignBlock(block);
    const o = self ? { x: 0, y: 0, z: 0 } : FACE[ev.blockFace] ?? { x: 0, y: 0, z: 0 };
    const loc = { x: block.x + o.x, y: block.y + o.y, z: block.z + o.z };
    system.run(() => show(player, dim, loc, self ? "このブロック" : "面の先"));
});

world.beforeEvents.playerPlaceBlock.subscribe((ev) => {
    if (inspectors.has(ev.player.id)) ev.cancel = true;
});
