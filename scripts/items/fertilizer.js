import * as server from "@minecraft/server";
import { Util } from "../utils/util";
const { world, system, ItemStack } = server;

system.beforeEvents.startup.subscribe(initEvent => {
    initEvent.itemComponentRegistry.registerCustomComponent('cw:plant_grow', {
        onUseOn(arg) {
            const block = arg.block
            const location = block.location
            const dimension = block.dimension
            const typeId = block.typeId
            if (!Object.keys(cropGrowthData).includes(typeId)) return;
            const permutation = block.permutation
            const permutationState = cropGrowthData[typeId].max
            if (permutation.getState(cropGrowthData[typeId].state) >= permutationState) return;
            const newPermutation = permutation.withState(cropGrowthData[typeId].state, permutationState)

            dimension.setBlockPermutation(location, newPermutation)
            const player = arg.source
            if (Util.reduceDurability(player, arg.itemStack)) {
                player.playSound("item.bone_meal.use")
            }
            else {
                player.playSound("item.axe.break")
                player.getComponent("minecraft:inventory").container.setItem(player.selectedSlotIndex, new ItemStack("minecraft:bundle", 1))
            }
        }
    });
});
const cropGrowthData = {
    "minecraft:wheat": { state: "growth", max: 7 },
    "minecraft:carrots": { state: "growth", max: 7 },
    "minecraft:potatoes": { state: "growth", max: 7 },
    "minecraft:beetroot": { state: "growth", max: 7 },
    "minecraft:nether_wart": { state: "age", max: 3 },
    "minecraft:cocoa": { state: "age", max: 2 },
    "minecraft:sweet_berry_bush": { state: "growth", max: 7 },
    "minecraft:pumpkin_stem": { state: "growth", max: 7 },
    "minecraft:melon_stem": { state: "growth", max: 7 },
    "minecraft:torchflower_crop": { state: "age", max: 2 },
    "minecraft:pitcher_crop": { state: "age", max: 4 }
};

