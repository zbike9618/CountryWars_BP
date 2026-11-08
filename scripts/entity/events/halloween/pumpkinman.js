import { world, system } from "@minecraft/server";

// スポーン時にカボチャ頭を装備
world.afterEvents.entitySpawn.subscribe((ev) => {
    const entity = ev.entity;
    if (entity.typeId === "cw:pumpkinman" || entity.typeId === "cw:event_trader") {
        if (!entity.isValid) return;
        entity.runCommand("replaceitem entity @s slot.armor.head 0 carved_pumpkin");
    }
});

// 攻撃を受けた時: 狂乱状態へ突入（ジャック・オ・ランタン点灯・スピード爆増・咆哮）
world.afterEvents.entityHurt.subscribe((ev) => {
    try {
        const entity = ev.hurtEntity;
        if (!entity || !entity.isValid || entity.typeId !== "cw:pumpkinman") return;

        // 狂乱イベントをトリガー
        entity.triggerEvent("cw:on_hurt_by_player");

        // 狂乱時は頭部をジャック・オ・ランタン(発光)に変更
        entity.runCommand("replaceitem entity @s slot.armor.head 0 lit_pumpkin");

        // スピード上昇 (Speed II: 約+40%) で猛追
        entity.addEffect("speed", 300, { amplifier: 1, showParticles: true });

        // 恐怖の咆哮演出
        entity.playSound("mob.ghast.scream", { volume: 0.9, pitch: 1.3 });
        entity.playSound("mob.warden.roar", { volume: 0.6, pitch: 1.6 });

        try {
            const loc = entity.location;
            entity.dimension.spawnParticle("minecraft:villager_angry", { x: loc.x, y: loc.y + 2.1, z: loc.z });
            entity.dimension.spawnParticle("minecraft:flame_particle", { x: loc.x, y: loc.y + 1.8, z: loc.z });
        } catch { }
    } catch (e) {
        console.error("pumpkinman hurt error:", e);
    }
});

// 近接攻撃命中時: 至近距離での接触により即座に頭部カボチャの自爆シークエンス開始
world.afterEvents.entityHitEntity.subscribe((ev) => {
    try {
        const attacker = ev.damagingEntity;
        const target = ev.hitEntity;
        if (!attacker || !attacker.isValid || attacker.typeId !== "cw:pumpkinman") return;
        if (!target || !target.isValid) return;

        // 既に爆発待機タグがあれば重複しない
        if (attacker.hasTag("cw:is_exploding")) return;
        attacker.addTag("cw:is_exploding");

        // 自爆シークエンス開始
        attacker.triggerEvent("cw:start_explode");
    } catch (e) {
        console.error("pumpkinman hitEntity error:", e);
    }
});
