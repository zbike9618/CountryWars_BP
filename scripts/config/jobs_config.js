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
            "minecraft:stone": 2,
            "minecraft:deepslate": 3,

            "minecraft:andesite": 2.5,
            "minecraft:granite": 2.5,
            "minecraft:diorite": 2.5,

            "minecraft:coal_ore": 15,
            "minecraft:iron_ore": 20,
            "minecraft:copper_ore": 20,
            "minecraft:lapis_ore": 20,
            "minecraft:redstone_ore": 20,

            "minecraft:gold_ore": 25,
            "minecraft:diamond_ore": 30,
            "minecraft:emerald_ore": 30,

            "minecraft:deepslate_coal_ore": 22.5,
            "minecraft:deepslate_iron_ore": 30,
            "minecraft:deepslate_copper_ore": 30,
            "minecraft:deepslate_lapis_ore": 30,
            "minecraft:deepslate_redstone_ore": 30,

            "minecraft:deepslate_gold_ore": 37.5,
            "minecraft:deepslate_diamond_ore": 45,
            "minecraft:deepslate_emerald_ore": 45
        }
    };
    static hunter = {
        mobRewards: {
            "minecraft:zombie": 2,
            "minecraft:skeleton": 2,
            "minecraft:creeper": 1.5,
            "minecraft:spider": 1,
            "minecraft:cave_spider": 1.5,

            "minecraft:enderman": 5,
            "minecraft:witch": 4,
            "minecraft:slime": 0.01,
            "minecraft:blaze": 1.5,
            "minecraft:drowned": 1.0,

            "minecraft:wither_skeleton": 4,
            "minecraft:ghast": 3,
            "minecraft:piglin": 3,
            "minecraft:zombie_pigman": 0.5,
            "minecraft:hoglin": 3,
            "minecraft:zoglin": 3,

            "minecraft:shulker": 5,
            "minecraft:bogged": 3,
            "minecraft:magma_cube": 1.5,

            "minecraft:phantom": 1.5,
            "minecraft:silverfish": 0.02,
            "minecraft:endermite": 10,

            "minecraft:guardian": 3,

            "minecraft:pillager": 3,
            "minecraft:vindicator": 3,
            "minecraft:evoker": 4,
            "minecraft:ravager": 50,
            "minecraft:vex": 10,

            "minecraft:breeze": 4,
            "minecraft:stray": 3,
            "minecraft:husk": 3,

            "minecraft:wither": 500,
            "minecraft:warden": 100,
            "minecraft:ender_dragon": 500,
            "minecraft:piglin_brute": 100,
            "minecraft:elder_guardian": 1000
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