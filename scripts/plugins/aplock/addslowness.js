import { world, system } from "@minecraft/server";
import * as server from "@minecraft/server";

// beforeEvent → afterEvent 間で既存エフェクトを一時保管
// key: player.id, value: { amplifier, duration }
const pendingRestore = new Map();

// パターンB用: 前tickのスニーク状態を記録
// key: player.id, value: boolean
const prevSneaking = new Map();

// =============================================================
// beforeEvent: 既存slowness を無条件に保存
// (trenbankai チェックは afterEvent で行う)
// =============================================================
world.beforeEvents.effectAdd.subscribe((ev) => {
    if (ev.effectType != "slowness") return;
    const player = ev.entity;
    if (player.typeId != "minecraft:player") return;

    const existing = player.getEffect("slowness");
    if (!existing) {
        system.run(() => world.sendMessage("§e[before] 既存slowness なし → 保存スキップ"));
        return;
    }

    // 既存slowness を常に保存（afterEventで必要か判断する）
    pendingRestore.set(player.id, {
        amplifier: existing.amplifier,
        duration: existing.duration
    });
    system.run(() => world.sendMessage(`§a[before] 保存: amp=${existing.amplifier} dur=${existing.duration}`));
});

// =============================================================
// afterEvent: trenbankai + スニーク確認 → 復活監視開始
// =============================================================
world.afterEvents.effectAdd.subscribe((ev) => {
    const player = ev.entity;
    world.sendMessage(`${ev.effect.typeId}`)
    if (ev.effect.typeId != "minecraft:slowness") return;
    if (player.typeId != "minecraft:player") return;


    world.sendMessage(`§b[after] slowness追加: amp=${ev.effect.amplifier} dur=${ev.effect.duration}`);

    const saved = pendingRestore.get(player.id);
    pendingRestore.delete(player.id);

    if (!saved) {
        world.sendMessage("§7[after] 既存slowness なかった → スキップ");
        return;
    }

    // afterEvent 側で trenbankai + スニーク確認
    const held = player.getComponent("minecraft:equippable")?.getEquipment(server.EquipmentSlot.Mainhand);
    if (!held || !held.typeId.startsWith("trenbankai:")) {
        world.sendMessage(`§7[after] trenbankai でない(${held?.typeId}) → スキップ`);
        return;
    }
    if (!player.isSneaking) {
        world.sendMessage("§7[after] スニーク中でない → スキップ");
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
        if (!current) {
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

