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
    if (!existing) {
        system.run(() => world.sendMessage("§e[before] 既存slowness なし → スキップ"));
        return;
    }

    const saved = { amplifier: existing.amplifier, duration: existing.duration };
    system.run(() => world.sendMessage(`§a[before] 既存slowness: amp=${saved.amplifier} dur=${saved.duration}`));

    // 次のtickでエフェクトが適用済みの状態でチェック
    system.run(() => {
        if (!player.isValid) return;

        // 既に監視中 → 重複起動しない
        if (watchingPlayers.has(player.id)) {
            world.sendMessage("§7[run] 既に監視中 → スキップ");
            return;
        }

        const held = player.getComponent("minecraft:equippable")?.getEquipment(server.EquipmentSlot.Mainhand);
        if (!held || !held.typeId.startsWith("trenbankai:")) {
            world.sendMessage(`§7[run] trenbankai でない(${held?.typeId}) → スキップ`);
            return;
        }
        if (!player.isSneaking) {
            world.sendMessage("§7[run] スニーク中でない → スキップ");
            return;
        }

        const newSlowness = player.getEffect("slowness");
        if (!newSlowness) {
            world.sendMessage("§7[run] slowness なし → スキップ");
            return;
        }

        world.sendMessage(`§a[run] 監視開始: 復活予定 amp=${saved.amplifier} / 現在 amp=${newSlowness.amplifier}`);
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
        if (!existing) {
            world.sendMessage("§e[B-sneak] slowness なし → スキップ");
            continue;
        }

        world.sendMessage(`§a[B-sneak] スニーク開始検知: amp=${existing.amplifier} dur=${existing.duration}`);
        // スニーク開始直後に slowness が変化するのを待って監視
        const saved = { amplifier: existing.amplifier, duration: existing.duration };
        system.run(() => {
            if (!player.isValid || watchingPlayers.has(player.id)) return;
            startRestoreWatch(player, saved);
        });
    }
}, 1);

// afterEvent 補助 (Pattern B pendingRestore は使わないため省略)
world.afterEvents.effectAdd.subscribe((ev) => {
    const player = ev.entity;
    if (player.typeId != "minecraft:player") return;
    if (ev.effect.typeId != "minecraft:slowness") return;
    world.sendMessage(`§b[after] slowness追加: amp=${ev.effect.amplifier} dur=${ev.effect.duration}`);
});

// =============================================================
// 共通: 復活監視 (slowness が消えたら元のを復活)
// =============================================================
/**
 * @param {import("@minecraft/server").Player} player
 * @param {{ amplifier: number, duration: number }} saved
 */
function startRestoreWatch(player, saved) {
    watchingPlayers.add(player.id);
    world.sendMessage("§b[watch] 監視スタート");

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
                    world.sendMessage(`§c[watch] slowness消滅 → 復活: amp=${saved.amplifier} dur=${saved.duration}`);
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
