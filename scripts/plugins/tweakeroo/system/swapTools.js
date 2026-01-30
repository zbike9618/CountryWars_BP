import * as server from "@minecraft/server"
const { world, system } = server;
import { JsonDypro } from "../util/jsonDypro.js";
const settingData = new JsonDypro("tweakeroo_setting")

world.afterEvents.playerSwingStart.subscribe((ev) => {
    const player = ev.player;
    if (ev.swingSource != "Mine") return

    if (!settingData.get(player)?.swapTools) return;
    const inv = player.getComponent("minecraft:inventory").container;
    const block = player.getBlockFromViewDirection({ maxDistance: 5 })
    if (!block) return;
    const blockType = block.block.typeId;
    const toolType = Appropriatetools[blockType];

    if (!toolType) return;
    const tool = inv.getItem(player.selectedSlotIndex);
    if (tool) {
        const toolType2 = tool.typeId.split("_")[1];
        if (toolType2 == toolType) return;
    }
    let slot = undefined;
    for (let i = 0; i < inv.size; i++) {
        const item2 = inv.getItem(i);
        if (!item2) continue;
        const toolType2 = item2.typeId.split("_")[1];
        if (toolType2 === toolType) {
            slot = i;
            break;
        }
    }
    world.sendMessage(`${slot}`)
    if (slot == undefined) return;
    inv.swapItems(player.selectedSlotIndex, slot, inv)
})
world.afterEvents.playerSwingStart.subscribe((ev) => {
    const player = ev.player;
    if (ev.swingSource != "Attack") return
    if (!settingData.get(player)?.swapTools) return;
    const target = player.getEntitiesFromViewDirection({ maxDistance: 5 })
    if (!target[0]?.entity) return;
    const inv = player.getComponent("minecraft:inventory").container;
    const tool = inv.getItem(player.selectedSlotIndex);
    if (tool) {
        const toolType2 = tool.typeId.split("_")[1];
        if (toolType2 == "sword") return;
    }
    let slot = undefined;
    for (let i = 0; i < inv.size; i++) {
        const item2 = inv.getItem(i);
        if (!item2) continue;
        const toolType2 = item2.typeId.split("_")[1];
        if (toolType2 === "sword") {
            slot = i;
            break;
        }
    }
    if (slot == undefined) return;
    inv.swapItems(player.selectedSlotIndex, slot, inv)
})
const Appropriatetools =
{
    "minecraft:grass_block": "shovel",
    "minecraft:dirt": "shovel",
    "minecraft:stone": "pickaxe",
    "minecraft:cobblestone": "pickaxe",
    "minecraft:sand": "shovel",
    "minecraft:sandstone": "pickaxe",
    "minecraft:gravel": "shovel",
    "minecraft:glass": "pickaxe",
    "minecraft:obsidian": "pickaxe",
    "minecraft:netherrack": "pickaxe",
    "minecraft:basalt": "pickaxe",
    "minecraft:blackstone": "pickaxe",
    "minecraft:deepslate": "pickaxe",
    "minecraft:cobbled_deepslate": "pickaxe",
    "minecraft:oak_log": "axe",
    "minecraft:spruce_log": "axe",
    "minecraft:birch_log": "axe",
    "minecraft:jungle_log": "axe",
    "minecraft:acacia_log": "axe",
    "minecraft:dark_oak_log": "axe",
    "minecraft:mangrove_log": "axe",
    "minecraft:cherry_log": "axe",
    "minecraft:crimson_stem": "axe",
    "minecraft:warped_stem": "axe",
    "minecraft:oak_planks": "axe",
    "minecraft:spruce_planks": "axe",
    "minecraft:birch_planks": "axe",
    "minecraft:jungle_planks": "axe",
    "minecraft:acacia_planks": "axe",
    "minecraft:dark_oak_planks": "axe",
    "minecraft:mangrove_planks": "axe",
    "minecraft:cherry_planks": "axe",
    "minecraft:crimson_planks": "axe",
    "minecraft:warped_planks": "axe",
    "minecraft:bamboo_planks": "axe",
    "minecraft:white_wool": "shears",
    "minecraft:orange_wool": "shears",
    "minecraft:magenta_wool": "shears",
    "minecraft:light_blue_wool": "shears",
    "minecraft:yellow_wool": "shears",
    "minecraft:lime_wool": "shears",
    "minecraft:pink_wool": "shears",
    "minecraft:gray_wool": "shears",
    "minecraft:light_gray_wool": "shears",
    "minecraft:cyan_wool": "shears",
    "minecraft:purple_wool": "shears",
    "minecraft:blue_wool": "shears",
    "minecraft:brown_wool": "shears",
    "minecraft:green_wool": "shears",
    "minecraft:red_wool": "shears",
    "minecraft:black_wool": "shears",
    "minecraft:snow": "shovel",
    "minecraft:snow_layer": "shovel",
    "minecraft:clay": "shovel",
    "minecraft:soul_sand": "shovel",
    "minecraft:soul_soil": "shovel",
    "minecraft:dirt_with_roots": "shovel",
    "minecraft:coarse_dirt": "shovel",
    "minecraft:podzol": "shovel",
    "minecraft:mycelium": "shovel",
    "minecraft:farmland": "shovel",
    "minecraft:grass_path": "shovel",
    "minecraft:concrete_powder": "shovel",
    "minecraft:iron_ore": "pickaxe",
    "minecraft:gold_ore": "pickaxe",
    "minecraft:diamond_ore": "pickaxe",
    "minecraft:lapis_ore": "pickaxe",
    "minecraft:redstone_ore": "pickaxe",
    "minecraft:coal_ore": "pickaxe",
    "minecraft:emerald_ore": "pickaxe",
    "minecraft:copper_ore": "pickaxe",
    "minecraft:quartz_ore": "pickaxe",
    "minecraft:nether_gold_ore": "pickaxe",
    "minecraft:ancient_debris": "pickaxe",
    "minecraft:raw_iron_block": "pickaxe",
    "minecraft:raw_gold_block": "pickaxe",
    "minecraft:raw_copper_block": "pickaxe",
    "minecraft:iron_block": "pickaxe",
    "minecraft:gold_block": "pickaxe",
    "minecraft:diamond_block": "pickaxe",
    "minecraft:lapis_block": "pickaxe",
    "minecraft:redstone_block": "pickaxe",
    "minecraft:coal_block": "pickaxe",
    "minecraft:emerald_block": "pickaxe",
    "minecraft:copper_block": "pickaxe",
    "minecraft:quartz_block": "pickaxe",
    "minecraft:netherite_block": "pickaxe",
    "minecraft:amethyst_block": "pickaxe",
    "minecraft:budding_amethyst": "pickaxe",
    "minecraft:amethyst_cluster": "pickaxe",
    "minecraft:bricks": "pickaxe",
    "minecraft:stone_bricks": "pickaxe",
    "minecraft:mossy_stone_bricks": "pickaxe",
    "minecraft:cracked_stone_bricks": "pickaxe",
    "minecraft:chiseled_stone_bricks": "pickaxe",
    "minecraft:end_stone": "pickaxe",
    "minecraft:end_stone_bricks": "pickaxe",
    "minecraft:prismarine": "pickaxe",
    "minecraft:prismarine_bricks": "pickaxe",
    "minecraft:dark_prismarine": "pickaxe",
    "minecraft:sea_lantern": "pickaxe",
    "minecraft:glowstone": "pickaxe",
    "minecraft:shulker_box": "pickaxe",
    "minecraft:ender_chest": "pickaxe",
    "minecraft:anvil": "pickaxe",
    "minecraft:chipped_anvil": "pickaxe",
    "minecraft:damaged_anvil": "pickaxe",
    "minecraft:bell": "pickaxe",
    "minecraft:brewing_stand": "pickaxe",
    "minecraft:cauldron": "pickaxe",
    "minecraft:furnace": "pickaxe",
    "minecraft:blast_furnace": "pickaxe",
    "minecraft:smoker": "pickaxe",
    "minecraft:hopper": "pickaxe",
    "minecraft:observer": "pickaxe",
    "minecraft:dropper": "pickaxe",
    "minecraft:dispenser": "pickaxe",
    "minecraft:piston": "pickaxe",
    "minecraft:sticky_piston": "pickaxe",
    "minecraft:enchanting_table": "pickaxe",
    "minecraft:grindstone": "pickaxe",
    "minecraft:stonecutter": "pickaxe",
    "minecraft:smithing_table": "pickaxe",
    "minecraft:cartography_table": "axe",
    "minecraft:fletching_table": "axe",
    "minecraft:crafting_table": "axe",
    "minecraft:barrel": "axe",
    "minecraft:chest": "axe",
    "minecraft:trapped_chest": "axe",
    "minecraft:jukebox": "axe",
    "minecraft:note_block": "axe",
    "minecraft:composter": "axe",
    "minecraft:lectern": "axe",
    "minecraft:bookshelf": "axe",
    "minecraft:chiseled_bookshelf": "axe",
    "minecraft:beehive": "axe",
    "minecraft:bee_nest": "axe",
    "minecraft:pumpkin": "axe",
    "minecraft:carved_pumpkin": "axe",
    "minecraft:melon_block": "axe",
    "minecraft:cocoa": "axe",
    "minecraft:jack_o_lantern": "axe",
    "minecraft:ladder": "axe",
    "minecraft:scaffolding": "axe",
    "minecraft:oak_fence": "axe",
    "minecraft:spruce_fence": "axe",
    "minecraft:birch_fence": "axe",
    "minecraft:jungle_fence": "axe",
    "minecraft:acacia_fence": "axe",
    "minecraft:dark_oak_fence": "axe",
    "minecraft:mangrove_fence": "axe",
    "minecraft:cherry_fence": "axe",
    "minecraft:crimson_fence": "axe",
    "minecraft:warped_fence": "axe",
    "minecraft:oak_fence_gate": "axe",
    "minecraft:spruce_fence_gate": "axe",
    "minecraft:birch_fence_gate": "axe",
    "minecraft:jungle_fence_gate": "axe",
    "minecraft:acacia_fence_gate": "axe",
    "minecraft:dark_oak_fence_gate": "axe",
    "minecraft:mangrove_fence_gate": "axe",
    "minecraft:cherry_fence_gate": "axe",
    "minecraft:crimson_fence_gate": "axe",
    "minecraft:warped_fence_gate": "axe",
    "minecraft:hay_block": "hoe",
    "minecraft:target": "hoe",
    "minecraft:shroomlight": "hoe",
    "minecraft:sponge": "hoe",
    "minecraft:wet_sponge": "hoe",
    "minecraft:leaves": "hoe",
    "minecraft:leaves2": "hoe",
    "minecraft:azalea_leaves": "hoe",
    "minecraft:flowering_azalea_leaves": "hoe",
    "minecraft:oak_leaves": "hoe",
    "minecraft:spruce_leaves": "hoe",
    "minecraft:birch_leaves": "hoe",
    "minecraft:jungle_leaves": "hoe",
    "minecraft:acacia_leaves": "hoe",
    "minecraft:dark_oak_leaves": "hoe",
    "minecraft:mangrove_leaves": "hoe",
    "minecraft:cherry_leaves": "hoe",
    "minecraft:sculk": "hoe",
    "minecraft:sculk_vein": "hoe",
    "minecraft:sculk_catalyst": "hoe",
    "minecraft:sculk_shrieker": "hoe",
    "minecraft:sculk_sensor": "hoe",
    "minecraft:calibrated_sculk_sensor": "hoe",
    "minecraft:moss_block": "hoe",
    "minecraft:moss_carpet": "hoe",
    "minecraft:warp_wart_block": "hoe",
    "minecraft:nether_wart_block": "hoe",
    "minecraft:dried_kelp_block": "hoe",
    "minecraft:acacia_wood": "axe",
    "minecraft:birch_wood": "axe",
    "minecraft:dark_oak_wood": "axe",
    "minecraft:jungle_wood": "axe",
    "minecraft:oak_wood": "axe",
    "minecraft:spruce_wood": "axe",
    "minecraft:stripped_acacia_log": "axe",
    "minecraft:stripped_birch_log": "axe",
    "minecraft:stripped_dark_oak_log": "axe",
    "minecraft:stripped_jungle_log": "axe",
    "minecraft:stripped_oak_log": "axe",
    "minecraft:stripped_spruce_log": "axe",
    "minecraft:stripped_mangrove_log": "axe",
    "minecraft:stripped_cherry_log": "axe",
    "minecraft:stripped_crimson_stem": "axe",
    "minecraft:stripped_warped_stem": "axe",
    "minecraft:ice": "pickaxe",
    "minecraft:packed_ice": "pickaxe",
    "minecraft:blue_ice": "pickaxe",
    "minecraft:magma_block": "pickaxe",
    "minecraft:bone_block": "pickaxe",
    "minecraft:terracotta": "pickaxe",
    "minecraft:white_terracotta": "pickaxe",
    "minecraft:orange_terracotta": "pickaxe",
    "minecraft:magenta_terracotta": "pickaxe",
    "minecraft:light_blue_terracotta": "pickaxe",
    "minecraft:yellow_terracotta": "pickaxe",
    "minecraft:lime_terracotta": "pickaxe",
    "minecraft:pink_terracotta": "pickaxe",
    "minecraft:gray_terracotta": "pickaxe",
    "minecraft:light_gray_terracotta": "pickaxe",
    "minecraft:cyan_terracotta": "pickaxe",
    "minecraft:purple_terracotta": "pickaxe",
    "minecraft:blue_terracotta": "pickaxe",
    "minecraft:brown_terracotta": "pickaxe",
    "minecraft:green_terracotta": "pickaxe",
    "minecraft:red_terracotta": "pickaxe",
    "minecraft:black_terracotta": "pickaxe",
    "minecraft:tuff": "pickaxe",
    "minecraft:calcite": "pickaxe",
    "minecraft:dripstone_block": "pickaxe",
    "minecraft:smooth_basalt": "pickaxe",
    "minecraft:mud_bricks": "pickaxe",
    "minecraft:packed_mud": "pickaxe",
    "minecraft:reinforced_deepslate": "pickaxe",
    "minecraft:concrete": "pickaxe",
    "minecraft:white_concrete": "pickaxe",
    "minecraft:orange_concrete": "pickaxe",
    "minecraft:magenta_concrete": "pickaxe",
    "minecraft:light_blue_concrete": "pickaxe",
    "minecraft:yellow_concrete": "pickaxe",
    "minecraft:lime_concrete": "pickaxe",
    "minecraft:pink_concrete": "pickaxe",
    "minecraft:gray_concrete": "pickaxe",
    "minecraft:light_gray_concrete": "pickaxe",
    "minecraft:cyan_concrete": "pickaxe",
    "minecraft:purple_concrete": "pickaxe",
    "minecraft:blue_concrete": "pickaxe",
    "minecraft:brown_concrete": "pickaxe",
    "minecraft:green_concrete": "pickaxe",
    "minecraft:red_concrete": "pickaxe",
    "minecraft:black_concrete": "pickaxe",
    "minecraft:glass_pane": "pickaxe",
    "minecraft:stained_glass": "pickaxe",
    "minecraft:stained_glass_pane": "pickaxe",
    "minecraft:hardened_clay": "pickaxe",
    "minecraft:stained_hardened_clay": "pickaxe",
    "minecraft:beacon": "pickaxe",
    "minecraft:conduit": "pickaxe",
    "minecraft:respawn_anchor": "pickaxe",
    "minecraft:lodestone": "pickaxe",
    "minecraft:chain": "pickaxe",
    "minecraft:iron_bars": "pickaxe",
    "minecraft:lantern": "pickaxe",
    "minecraft:soul_lantern": "pickaxe",
    "minecraft:campfire": "axe",
    "minecraft:soul_campfire": "axe",
    "minecraft:oak_log": "axe",



}