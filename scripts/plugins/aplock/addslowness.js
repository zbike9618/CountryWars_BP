import { world, system } from "@minecraft/server";
import * as server from "@minecraft/server";

// beforeEvent → afterEvent 間で既存エフェクトを一時保管
// key: player.id, value: { amplifier, duration }
const pendingRestore = new Map();

// パターンB用: 前tickのスニーク状態を記録
// key: player.id, value: boolean
const prevSneaking = new Map();

// =============================================================
// パターンA: スニーク中に trenbankai slowness が追加される場合
// beforeEvent で既存slowness を保存
// =============================================================
world.beforeEvents.effectAdd.subscribe((ev) => {
    if (ev.effectType != "slowness") return;
    const player = ev.entity;
    if (player.typeId != "minecraft:player") return;

    // スニーク中 + trenbankai: アイテム所持の場合のみ保存
    if (!player.isSneaking) return;
    const held = player.getComponent("minecraft:equippable")?.getEquipment(server.EquipmentSlot.Mainhand);
    if (!held || !held.typeId.startsWith("trenbankai:")) return;

    const existing = player.getEffect("slowness");
    if (!existing) return;

    pendingRestore.set(player.id, {
        amplifier: existing.amplifier,
        duration: existing.duration
    });
});

// afterEvent: 新しい slowness の amplifier を記録して復活監視開始
world.afterEvents.effectAdd.subscribe((ev) => {
    const player = ev.entity;

    if (ev.effect.typeId != "slowness" || player.typeId != "minecraft:player") {
        if (player.typeId === "minecraft:player") {
            pendingRestore.delete(player.id);
        }
        return;
    }

    const saved = pendingRestore.get(player.id);
    pendingRestore.delete(player.id);

    if (!saved) return;

    startRestoreWatch(player, saved, ev.effect.amplifier);
});

// =============================================================
// パターンB: ポーションでslownessを受けた後にスニーク開始する場合
// 毎tick スニーク開始を検出して既存slowness を先に保存
// =============================================================
system.runInterval(() => {
    for (const player of world.getAllPlayers()) {
        const wasSneaking = prevSneaking.get(player.id) ?? false;
        const nowSneaking = player.isSneaking;
        prevSneaking.set(player.id, nowSneaking);

        // スニーク開始の瞬間のみ処理
        if (wasSneaking || !nowSneaking) continue;

        // trenbankai: アイテムを持っているか確認
        const held = player.getComponent("minecraft:equippable")?.getEquipment(server.EquipmentSlot.Mainhand);
        if (!held || !held.typeId.startsWith("trenbankai:")) continue;

        // 既存slowness を pendingRestore に保存（beforeEventより先に実行）
        const existing = player.getEffect("slowness");
        if (!existing) continue;

        // まだ保存されていない場合のみ上書き
        if (!pendingRestore.has(player.id)) {
            pendingRestore.set(player.id, {
                amplifier: existing.amplifier,
                duration: existing.duration
            });
        }
    }
}, 1);

// =============================================================
// 共通: 復活監視
// =============================================================
/**
 * @param {import("@minecraft/server").Player} player
 * @param {{ amplifier: number, duration: number }} saved
 * @param {number} newAmplifier
 */
function startRestoreWatch(player, saved, newAmplifier) {
    const tick = system.runInterval(() => {
        if (!player.isValid) {
            system.clearRun(tick);
            return;
        }
        const current = player.getEffect("slowness");

        // trenbankai slowness が消えた or 別の amplifier に変わった
        if (!current || current.amplifier !== newAmplifier) {
            system.clearRun(tick);
            system.run(() => {
                player.addEffect("slowness", saved.duration, {
                    amplifier: saved.amplifier,
                    showParticles: true
                });
            });
        }
    }, 1);
}
