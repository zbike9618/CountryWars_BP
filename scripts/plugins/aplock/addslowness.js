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
    if (!existing) {
        system.run(() => world.sendMessage("§e[A-before] slowness なし → スキップ"));
        return;
    }

    pendingRestore.set(player.id, {
        amplifier: existing.amplifier,
        duration: existing.duration
    });
    system.run(() => world.sendMessage(`§a[A-before] 保存: amp=${existing.amplifier} dur=${existing.duration}`));
});

// afterEvent: slowness が追加されたときのみ pendingRestore を参照
// ※ slowness 以外のエフェクトでは削除しない（削除タイミングは slowness 追加時のみ）
world.afterEvents.effectAdd.subscribe((ev) => {
    const player = ev.entity;
    if (ev.effect.typeId != "slowness") return;
    if (player.typeId != "minecraft:player") return;

    world.sendMessage(`§b[after] slowness 追加: amp=${ev.effect.amplifier} dur=${ev.effect.duration}`);

    const saved = pendingRestore.get(player.id);
    pendingRestore.delete(player.id);

    if (!saved) {
        world.sendMessage("§7[after] pendingRestore なし → 監視しない");
        return;
    }

    world.sendMessage(`§a[after] 監視開始: 復活予定 amp=${saved.amplifier} dur=${saved.duration}`);
    startRestoreWatch(player, saved, ev.effect.duration);
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
        if (!existing) {
            world.sendMessage("§e[B-sneak] slowness なし → スキップ");
            continue;
        }

        // まだ保存されていない場合のみセット
        if (!pendingRestore.has(player.id)) {
            pendingRestore.set(player.id, {
                amplifier: existing.amplifier,
                duration: existing.duration
            });
            world.sendMessage(`§a[B-sneak] 保存: amp=${existing.amplifier} dur=${existing.duration}`);
        } else {
            world.sendMessage("§7[B-sneak] 既に保存済み → スキップ");
        }
    }
}, 1);

// =============================================================
// 共通: 復活監視
// duration ベースで trenbankai slowness の終了を判定
// =============================================================
/**
 * @param {import("@minecraft/server").Player} player
 * @param {{ amplifier: number, duration: number }} saved
 * @param {number} watchDuration - 追加された trenbankai slowness の初期duration
 */
function startRestoreWatch(player, saved, watchDuration) {
    world.sendMessage(`§b[watch] 監視スタート: watchDuration=${watchDuration}`);

    const tick = system.runInterval(() => {
        if (!player.isValid) {
            system.clearRun(tick);
            return;
        }
        const current = player.getEffect("slowness");

        // slowness が完全に消えた、または残り2tick以下になった
        if (!current || current.duration <= 2) {
            system.clearRun(tick);
            const reason = !current ? "slowness消滅" : `残りdur=${current.duration}`;
            system.run(() => {
                if (!player.isValid) return;
                world.sendMessage(`§c[watch] 終了検知(${reason}) → 復活開始`);
                player.addEffect("slowness", saved.duration, {
                    amplifier: saved.amplifier,
                    showParticles: true
                });
                world.sendMessage(`§a[watch] 復活: amp=${saved.amplifier} dur=${saved.duration}`);
            });
        }
    }, 1);
}

