import { world } from "@minecraft/server";

// スポーン時にカボチャ頭を装備
world.afterEvents.entitySpawn.subscribe((ev) => {
    const entity = ev.entity;
    if (entity.typeId === "cw:pumpkinman" || entity.typeId === "cw:event_trader") {
        if (!entity.isValid) return;
        entity.runCommand("replaceitem entity @s slot.armor.head 0 carved_pumpkin");
    }
});

// 狂乱（プレイヤーに攻撃されたとき）と自爆（狙っているプレイヤーに近づいたとき）は、
// エンティティの定義（entities/events/halloween/pumpkinman.json）の
// minecraft:damage_sensor と minecraft:target_nearby_sensor が起こす。
// 頭のジャック・オ・ランタン・スピード・音・パーティクルも、定義のイベントの queue_command で出す。
// ここから triggerEvent すると同じイベントが2回起きるので、スクリプトでは扱わない。
