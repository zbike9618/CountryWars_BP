import { world, system } from "@minecraft/server";

system.beforeEvents.startup.subscribe(ev => {
    ev.blockComponentRegistry.registerCustomComponent("cw:landmine", {
        onStepOn(event) {
            const { block, entity } = event;

            // エンティティが存在し、プレイヤーである場合のみ爆発
            if (entity && entity.typeId === "minecraft:player") {
                explode(block);
            }
        }
    });
});

function explode(block) {
    if (block.typeId !== "cw:landmine") return;

    const { dimension, location } = block;

    // 爆発を作成（座標の中心に調整）
    dimension.createExplosion(
        {
            x: location.x + 0.5,
            y: location.y + 0.5,
            z: location.z + 0.5
        },
        4,  // 爆発の強さ
        {
            breaksBlocks: true,
            causesFire: false
        }
    );

    // ブロックを削除
    block.setType("minecraft:air");
}
