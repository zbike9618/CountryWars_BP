import { world, system } from "@minecraft/server";
import * as server from "@minecraft/server";

// key: player.id, value: { amplifier, duration }
const pendingRestore = new Map();

// パターンB用: 前tickのスニーク状態を記録
const prevSneaking = new Map();

// =============================================================
// beforeEvents: 既存slowness を保存 → 次tickでtrenbankai判定
// afterEvents は Turtle Master等のポーション由来slownessに
// 発火しない場合があるため使用しない
// =============================================================
world.beforeEvents.effectAdd.subscribe((ev) => {
    if (ev.effectType != "slowness") return;
    const player = ev.entity;
    if (player.typeId != "minecraft:player") return;

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

        // trenbankai: + スニーク中かチェック
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
            world.sendMessage("§7[run] slowness が見つからない → スキップ");
            return;
        }

        world.sendMessage(`§a[run] 監視開始: 復活予定 amp=${saved.amplifier} / 現在 amp=${newSlowness.amplifier}`);
        startRestoreWatch(player, saved);
    });
});

// =============================================================
// パターンB: ポーションでslownessを受けた後にスニーク開始する場合
// スニーク開始の瞬間に既存slowness を保存して次tick監視
// =============================================================
system.runInterval(() => {
    for (const player of world.getAllPlayers()) {
        const wasSneaking = prevSneaking.get(player.id) ?? false;
        const nowSneaking = player.isSneaking;
        prevSneaking.set(player.id, nowSneaking);

        // スニーク開始の瞬間のみ
        if (wasSneaking || !nowSneaking) continue;

        const held = player.getComponent("minecraft:equippable")?.getEquipment(server.EquipmentSlot.Mainhand);
        if (!held || !held.typeId.startsWith("trenbankai:")) continue;

        const existing = player.getEffect("slowness");
        if (!existing) {
            world.sendMessage("§e[B-sneak] slowness なし → スキップ");
            continue;
        }

        if (!pendingRestore.has(player.id)) {
            pendingRestore.set(player.id, {
                amplifier: existing.amplifier,
                duration: existing.duration
            });
            world.sendMessage(`§a[B-sneak] 保存: amp=${existing.amplifier} dur=${existing.duration}`);
        }
    }
}, 1);

// afterEvent は Turtle Master等で slowness に発火しないケースがあるため
// Pattern B の pendingRestore を消費する補助としてのみ使用
world.afterEvents.effectAdd.subscribe((ev) => {
    const player = ev.entity;
    if (player.typeId != "minecraft:player") return;
    if (ev.effect.typeId != "minecraft:slowness") return;

    const saved = pendingRestore.get(player.id);
    if (!saved) return;
    pendingRestore.delete(player.id);

    const held = player.getComponent("minecraft:equippable")?.getEquipment(server.EquipmentSlot.Mainhand);
    if (!held || !held.typeId.startsWith("trenbankai:")) return;
    if (!player.isSneaking) return;

    world.sendMessage(`§a[after-B] 監視開始: amp=${saved.amplifier} dur=${saved.duration}`);
    startRestoreWatch(player, saved);
});

// =============================================================
// 共通: 復活監視 (slowness が消えたら元のを復活)
// =============================================================
/**
 * @param {import("@minecraft/server").Player} player
 * @param {{ amplifier: number, duration: number }} saved
 */
function startRestoreWatch(player, saved) {
    world.sendMessage("§b[watch] 監視スタート");
    const tick = system.runInterval(() => {
        if (!player.isValid) {
            system.clearRun(tick);
            return;
        }
        const current = player.getEffect("slowness");
        if (!current) {
            system.clearRun(tick);
            system.run(() => {
                if (!player.isValid) return;
                world.sendMessage(`§c[watch] slowness消滅 → 復活: amp=${saved.amplifier} dur=${saved.duration}`);
                player.addEffect("slowness", saved.duration, {
                    amplifier: saved.amplifier,
                    showParticles: true
                });
            });
        }
    }, 1);
}
