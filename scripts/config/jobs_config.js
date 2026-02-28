export class JobsConfig {
    static JOB_LIMIT = 4; // 最大職業数
    static jobList = ["miner", "hunter", "lumberjack", "netherdigger", "builder"]
}

// 職業ごとの設定ファイル




// 職業ごとの報酬設定
// 各職業ごとに、対象ブロックやモンスターと報酬額を設定

export class JOB_CONFIG {
    static miner = {
        blockRewards: {
            "minecraft:stone": 0.2,
            "minecraft:andesite": 0.3,
            "minecraft:granite": 0.3,
            "minecraft:diorite": 0.3,
            "minecraft:coal_ore": 0.7,
            "minecraft:iron_ore": 0.7,
            "minecraft:gold_ore": 0.7,
            "minecraft:diamond_ore": 0.7,
            "minecraft:emerald_ore": 0.7,
            "minecraft:deepslate_coal_ore": 1.0,
            "minecraft:deepslate_iron_ore": 1.0,
            "minecraft:deepslate_gold_ore": 1.5,
            "minecraft:deepslate_diamond_ore": 2.5,
            "minecraft:deepslate_emerald_ore": 2.5
        }
    };
    static hunter = {
        mobRewards: {
            "minecraft:zombie": 1.0,
            "minecraft:skeleton": 1.0,
            "minecraft:creeper": 1.5,
            "minecraft:spider": 0.7,
            "minecraft:enderman": 2.5,
            "minecraft:witch": 2.0,
            "minecraft:slime": 0.5,
            "minecraft:blaze": 1.5,
            "minecraft:drowned": 1.0,
            "minecraft:wither_skeleton": 2.0,
            "minecraft:ghast": 2.5,
            "minecraft:piglin": 1.5,
            "minecraft:zombie_pigman": 1.5,
            "minecraft:hoglin": 2.0,
            "minecraft:zoglin": 2.0,
            "minecraft:ender_dragon": 50.0,
            "minecraft:shulker": 3.0,
            "minecraft:bogged": 1.5,
            "minecraft:magma_cube": 0.5,
            "minecraft:cave_spider": 1.0,
            "minecraft:warden": 10.0,
            "minecraft:phantom": 1.5,
            "minecraft:silverfish": 0.1,
            "minecraft:piglin_brute": 3

        }
    };
    static lumberjack = {
        blockRewards: {
            "minecraft:oak_log": 0.5,
            "minecraft:birch_log": 0.5,
            "minecraft:spruce_log": 0.5,
            "minecraft:jungle_log": 0.6,
            "minecraft:acacia_log": 0.6,
            "minecraft:dark_oak_log": 0.7,
            "minecraft:mangrove_log": 0.7,
            "minecraft:cherry_log": 0.7
        }
    };
    static farmer = {
        blockRewards: {
            "minecraft:wheat": 0.2,
            "minecraft:carrots": 0.2,
            "minecraft:potatoes": 0.2,
            "minecraft:beetroot": 0.2,
            "minecraft:farmland": 0.1
        }
    };
    static netherdigger = {
        blockRewards: {
            "minecraft:netherrack": 0.1,
            "minecraft:basalt": 0.2,
            "minecraft:blackstone": 0.4,
            "minecraft:ancient_debris": 10.0
        }
    };
    static builder = {
        blockRewards: {
            // 建築で使うブロックを壊す/設置で報酬を変える運用も可能
            "stone": 0.1,
            "brick": 0.2,
            "planks": 0.1,
            "glass": 0.1,
            "redstone": 0.1,
        }
    }
};
