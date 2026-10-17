import { system } from "@minecraft/server";

system.beforeEvents.startup.subscribe(ev => {
    ev.blockComponentRegistry.registerCustomComponent("cw:mana_rose", {
        onRandomTick(event) {
            const { block } = event;
            const permutation = block.permutation;
            const age = permutation.getState("cw:age");
            if (typeof age === "number" && age < 3) {
                // 5% の確率で成長 (元イベントの weight 5 / 100 に準拠)
                if (Math.random() < 0.05) {
                    block.setPermutation(permutation.withState("cw:age", age + 1));
                }
            }
        },
        onPlayerInteract(event) {
            const { block, player } = event;
            if (!player) return;
            const equippable = player.getComponent("minecraft:equippable");
            const mainhand = equippable?.getEquipment("Mainhand");
            const permutation = block.permutation;
            const age = permutation.getState("cw:age");

            // 骨粉で成長促進
            if (mainhand && mainhand.typeId === "minecraft:bone_meal") {
                if (typeof age === "number" && age < 3) {
                    if (player.getGameMode() !== "creative") {
                        if (mainhand.amount > 1) {
                            mainhand.amount -= 1;
                            equippable.setEquipment("Mainhand", mainhand);
                        } else {
                            equippable.setEquipment("Mainhand", undefined);
                        }
                    }
                    block.dimension.spawnParticle("minecraft:crop_growth_emitter", {
                        x: block.location.x + 0.5,
                        y: block.location.y + 0.5,
                        z: block.location.z + 0.5
                    });
                    player.playSound("item.bone_meal.use");
                    const growAmount = Math.random() < 0.5 ? 1 : 2;
                    const nextAge = Math.min(3, age + growAmount);
                    block.setPermutation(permutation.withState("cw:age", nextAge));
                }
            }
        }
    });
});
