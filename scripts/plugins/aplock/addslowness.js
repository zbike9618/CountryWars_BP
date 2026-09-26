import { world, system } from "@minecraft/server";

// beforeEvent → afterEvent 間で既存エフェクトを一時保管
// key: player.id, value: { amplifier, duration, newAmplifier? }
const pendingRestore = new Map();

// ① beforeEvent: trenbankai: + シフト時に既存slownessを保存
world.beforeEvents.effectAdd.subscribe((ev) => {
    if (ev.effectType != "slowness") return;
    const player = ev.entity;
    if (player.typeId != "minecraft:player") return;

    // trenbankai: アイテムをシフトしながら使っている場合のみ対象
    if (!player.isSneaking) return;
    const held = player.getComponent("minecraft:equippable")?.getEquipment("Mainhand");
    if (!held || !held.typeId.startsWith("trenbankai:")) return;

    const existing = player.getEffect("slowness");
    if (!existing) return;

    pendingRestore.set(player.id, {
        amplifier: existing.amplifier,
        duration: existing.duration
    });
});

// ② afterEvent: 追加後に新しいamplifierを記録して復活監視を開始
world.afterEvents.effectAdd.subscribe((ev) => {
    const player = ev.entity;

    // slowness 以外 or プレイヤー以外は Map をクリーンアップして終了
    if (ev.effect.typeId != "slowness" || player.typeId != "minecraft:player") {
        if (player.typeId === "minecraft:player") {
            pendingRestore.delete(player.id);
        }
        return;
    }

    const saved = pendingRestore.get(player.id);
    pendingRestore.delete(player.id);

    // trenbankai 由来でない slowness はスルー
    if (!saved) return;

    const { amplifier: savedAmplifier, duration: savedDuration } = saved;
    const newAmplifier = ev.effect.amplifier;

    // trenbankai slowness が終わったら元のエフェクトを復活させる
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
                player.addEffect("slowness", savedDuration, {
                    amplifier: savedAmplifier,
                    showParticles: true
                });
            });
        }
    }, 1);
});
