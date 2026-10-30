import { world, system } from "@minecraft/server";

// 3倍ドロップの発動確率 (30%)
const TRIPLE_DROP_CHANCE = 0.3;

// 対象となる鉱石ブロック一覧
const ORE_BLOCK_IDS = new Set([
    // バニラ鉱石
    "minecraft:coal_ore",
    "minecraft:deepslate_coal_ore",
    "minecraft:iron_ore",
    "minecraft:deepslate_iron_ore",
    "minecraft:copper_ore",
    "minecraft:deepslate_copper_ore",
    "minecraft:gold_ore",
    "minecraft:deepslate_gold_ore",
    "minecraft:redstone_ore",
    "minecraft:deepslate_redstone_ore",
    "minecraft:lit_redstone_ore",
    "minecraft:lit_deepslate_redstone_ore",
    "minecraft:lapis_ore",
    "minecraft:deepslate_lapis_ore",
    "minecraft:diamond_ore",
    "minecraft:deepslate_diamond_ore",
    "minecraft:emerald_ore",
    "minecraft:deepslate_emerald_ore",
    "minecraft:quartz_ore",
    "minecraft:nether_gold_ore",
    "minecraft:ancient_debris",

    // カスタム鉱石
    "cw:platinum_ore",
    "cw:end_ore",
    "cw:sulfur_ore"
]);

world.afterEvents.playerBreakBlock.subscribe((ev) => {
    const { player, brokenBlockPermutation, itemStackBeforeBreak, block } = ev;
    if (!player || !itemStackBeforeBreak) return;

    // ghost_pickaxe かチェック
    if (itemStackBeforeBreak.typeId !== "cw:ghost_pickaxe") return;

    // シルクタッチが付いている場合は効果を発動しない
    const enchantable = itemStackBeforeBreak.getComponent("minecraft:enchantable");
    if (enchantable?.hasEnchantment("silk_touch")) return;

    const blockId = brokenBlockPermutation.type.id;
    if (!ORE_BLOCK_IDS.has(blockId)) return;

    // 確率判定 (30%)
    if (Math.random() >= TRIPLE_DROP_CHANCE) return;

    const loc = block.location;
    const x = loc.x + 0.5;
    const y = loc.y + 0.5;
    const z = loc.z + 0.5;

    try {
        // 対象のブロックを一時的に戻して mine でルートを生成
        block.setPermutation(brokenBlockPermutation);
        try {
            // mainhand を使ったブロック採掘ドロップ（mine）を2回実行（通常破壊分と合わせて合計3倍）
            player.runCommand(`loot spawn ${x} ${y} ${z} mine ${loc.x} ${loc.y} ${loc.z} mainhand`);
            player.runCommand(`loot spawn ${x} ${y} ${z} mine ${loc.x} ${loc.y} ${loc.z} mainhand`);
        } finally {
            // 必ず空気に戻す
            block.setType("minecraft:air");
        }

        // 演出（音、パーティクル、通知）
        player.dimension.playSound("random.levelup", loc, { pitch: 1.8, volume: 0.8 });
        player.dimension.spawnParticle("minecraft:villager_happy", { x, y, z });
        player.onScreenDisplay.setActionBar("§d§l★ ゴーストパワー発動！ 鉱石ドロップ3倍！ ★");
    } catch (e) {
        console.error("ghost_pickaxe mine drop error:", e);
    }
});
