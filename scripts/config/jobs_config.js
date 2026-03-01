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
            "minecraft:stone": 1,
            "minecraft:deepslate": 1.5,
            "minecraft:andesite": 1.2,
            "minecraft:granite": 1.2,
            "minecraft:diorite": 1.2,
            "minecraft:coal_ore": 6,
            "minecraft:iron_ore": 12,
            "minecraft:gold_ore": 16,
            "minecraft:diamond_ore": 20,
            "minecraft:emerald_ore": 25,
            "minecraft:deepslate_coal_ore": 8,
            "minecraft:deepslate_iron_ore": 15,
            "minecraft:deepslate_gold_ore": 18,
            "minecraft:deepslate_diamond_ore": 22,
            "minecraft:deepslate_emerald_ore": 30
        }
    };
    static hunter = {
        mobRewards: {
            "minecraft:zombie": 1.5,
            "minecraft:skeleton": 1.5,
            "minecraft:creeper": 1.5,
            "minecraft:spider": 0.7,
            "minecraft:enderman": 2.5,
            "minecraft:witch": 2.0,
            "minecraft:slime": 0.01,
            "minecraft:blaze": 1.5,
            "minecraft:drowned": 1.0,
            "minecraft:wither_skeleton": 3.0,
            "minecraft:wither": 50.0,
            "minecraft:ghast": 2.5,
            "minecraft:piglin": 1.5,
            "minecraft:zombie_pigman": 0.5,
            "minecraft:hoglin": 2.0,
            "minecraft:zoglin": 2.0,
            "minecraft:ender_dragon": 100.0,
            "minecraft:shulker": 3.0,
            "minecraft:bogged": 1.5,
            "minecraft:magma_cube": 1.5,
            "minecraft:cave_spider": 1.0,
            "minecraft:warden": 50,
            "minecraft:phantom": 1.5,
            "minecraft:silverfish": 0.02,
            "minecraft:piglin_brute": 3

        }
    };
    static lumberjack = {
        blockRewards: {
            "minecraft:oak_log": 3.5,
            "minecraft:birch_log": 3.5,
            "minecraft:spruce_log": 2.5,
            "minecraft:jungle_log": 3.5,
            "minecraft:acacia_log": 3.5,
            "minecraft:dark_oak_log": 2.5,
            "minecraft:mangrove_log": 4,
            "minecraft:cherry_log": 4
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
            "minecraft:netherrack": 0.15,
            "minecraft:basalt": 0.5,
            "minecraft:blackstone": 0.5,
            "minecraft:ancient_debris": 20
        }
    };
    static builder = {
        blockRewards: {
            // 建築で使うブロックを壊す/設置で報酬を変える運用も可能
            "stone": 0.5,
            "brick": 0.5,
            "planks": 0.5,
            "glass": 0.5
        }
    }
};