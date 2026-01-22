import { world, system, } from "@minecraft/server";
import "./kaihuku_kit.js";
import "./xp_box.js";
import "./mega_item.js";
import "./shinai.js";
import "./security_camera.js";

world.afterEvents.worldLoad.subscribe((event) => {


    system.runInterval(() => {
        for (const player of world.getAllPlayers()) {
            const comp = player.getComponent("minecraft:equippable")
            if (!comp) return;
            const item = comp.getEquipment("Head")
            if (!item) return;
            if (item.typeId == "cw:anshi_goggle") {
                player.addEffect("minecraft:night_vision", 240, {
                    amplifier: 0,
                    showParticles: false
                })
            }
        }

    }, 20)
});

world.afterEvents.itemUse.subscribe((event) => {
    const player = event.source;
    const itemId = event.itemStack.typeId; // ← typeId に修正（Idではない）

    if (itemId === "cw:magnet") {
        const playerPos = player.location; // プレイヤーの正確な位置
        const dimension = player.dimension;

        // 半径20ブロック内のアイテムエンティティを取得
        const nearbyEntities = dimension.getEntities({
            location: playerPos,
            maxDistance: 20,
            type: "minecraft:item"
        });

        for (const entity of nearbyEntities) {
            entity.teleport(playerPos, {
                dimension,
                rotation: { x: 0, y: 0 },
                facingLocation: playerPos,
                checkForBlocks: false
            });
        }

    }
});
