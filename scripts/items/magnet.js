import * as server from "@minecraft/server";
const { world } = server;
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