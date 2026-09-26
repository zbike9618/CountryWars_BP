import { world, system } from "@minecraft/server";
import * as server from "@minecraft/server";

// 復活監視中のプレイヤー (重複watch防止)
const watchingPlayers = new Set();

// 復活addEffect実行中のプレイヤー (beforeEventループ防止)
const restoringPlayers = new Set();

// パターンB用: 前tickのスニーク状態を記録
const prevSneaking = new Map();

// =============================================================
// beforeEvents: 既存slowness を保存 → 次tickでtrenbankai判定
// =============================================================
world.beforeEvents.effectAdd.subscribe((ev) => {
    if (ev.effectType != "slowness") return;
    const player = ev.entity;
    if (player.typeId != "minecraft:player") return;

    // 復活処理中は再トリガーしない
    if (restoringPlayers.has(player.id)) return;

    const existing = player.getEffect("slowness");
    if (!existing) return;

    const saved = { amplifier: existing.amplifier, duration: existing.duration };

    // 次のtickでエフェクトが適用済みの状態でチェック
    system.run(() => {
        if (!player.isValid) return;

        // 既に監視中 → 重複起動しない
        if (watchingPlayers.has(player.id)) return;

        const held = player.getComponent("minecraft:equippable")?.getEquipment(server.EquipmentSlot.Mainhand);
        if (!held || !held.typeId.startsWith("trenbankai:")) return;
        if (!player.isSneaking) return;

        const newSlowness = player.getEffect("slowness");
        if (!newSlowness) return;

        startRestoreWatch(player, saved);
    });
});

// =============================================================
// パターンB: ポーションでslownessを受けた後にスニーク開始する場合
// =============================================================
system.runInterval(() => {
    for (const player of world.getAllPlayers()) {
        const wasSneaking = prevSneaking.get(player.id) ?? false;
        const nowSneaking = player.isSneaking;
        prevSneaking.set(player.id, nowSneaking);

        if (wasSneaking || !nowSneaking) continue;
        if (watchingPlayers.has(player.id)) continue;

        const held = player.getComponent("minecraft:equippable")?.getEquipment(server.EquipmentSlot.Mainhand);
        if (!held || !held.typeId.startsWith("trenbankai:")) continue;

        const existing = player.getEffect("slowness");
        if (!existing) continue;

        // スニーク開始直後に slowness が変化するのを待って監視
        const saved = { amplifier: existing.amplifier, duration: existing.duration };
        system.run(() => {
            if (!player.isValid || watchingPlayers.has(player.id)) return;
            startRestoreWatch(player, saved);
        });
    }
}, 1);

// =============================================================
// 共通: 復活監視 (slowness が消えたら元のを復活)
// =============================================================
/**
 * @param {import("@minecraft/server").Player} player
 * @param {{ amplifier: number, duration: number }} saved
 */
function startRestoreWatch(player, saved) {
    watchingPlayers.add(player.id);

    const tick = system.runInterval(() => {
        if (!player.isValid) {
            system.clearRun(tick);
            watchingPlayers.delete(player.id);
            return;
        }
        const current = player.getEffect("slowness");
        if (!current) {
            system.clearRun(tick);
            watchingPlayers.delete(player.id);

            // 復活フラグを立ててから addEffect
            restoringPlayers.add(player.id);
            system.run(() => {
                if (player.isValid) {
                    player.addEffect("slowness", saved.duration, {
                        amplifier: saved.amplifier,
                        showParticles: true
                    });
                }
                // 次tickでフラグ解除
                system.run(() => restoringPlayers.delete(player.id));
            });
        }
    }, 1);
}

