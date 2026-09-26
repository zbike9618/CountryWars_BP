import { world, system } from "@minecraft/server";

// beforeEvent → afterEvent 間で既存エフェクトを一時保管
// key: player.id, value: { amplifier, duration }
const pendingRestore = new Map();

// ① beforeEvent: 追加「前」の既存slownessを保存
world.beforeEvents.effectAdd.subscribe((ev) => {
    if (ev.effectType != "slowness") return;
    const player = ev.entity;
    if (player.typeId != "minecraft:player") return;

    const existing = player.getEffect("slowness");
    if (!existing) return;

    pendingRestore.set(player.id, {
        amplifier: existing.amplifier,
        duration: existing.duration
    });
});

// ② afterEvent: 追加「後」の新しいamplifierを確認
world.afterEvents.effectAdd.subscribe((ev) => {
    const player = ev.entity;

    // slowness 以外のエフェクトでも、Mapに残っていれば消す
    if (ev.effect.typeId != "slowness" || player.typeId != "minecraft:player") {
        if (player.typeId === "minecraft:player") {
            pendingRestore.delete(player.id);
        }
        return;
    }

    // slowness かつ player の場合: 必ずここでMapを削除
    const saved = pendingRestore.get(player.id);
    pendingRestore.delete(player.id);

    // 新しいエフェクトが level 10 以上 (amplifier >= 9) かチェック
    if (ev.effect.amplifier < 9) return;
    if (!saved) return;

    const { amplifier: savedAmplifier, duration: savedDuration } = saved;

    // level 10+ が終了したら元のエフェクトを復活させる
    const tick = system.runInterval(() => {
        if (!player.isValid) {
            system.clearRun(tick);
            return;
        }
        const current = player.getEffect("slowness");

        // level 10+ が消えた or amplifier が 9 未満に下がった
        if (!current || current.amplifier < 9) {
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
