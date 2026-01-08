// 職業ごとの設定ファイル


export const JOB_LIMIT = 4; // 最大職業数

// 職業ごとの報酬設定
// 各職業ごとに、対象ブロックやモンスターと報酬額を設定

export const JOB_CONFIG = {
    miner: {
        name: "鉱夫",
        blockRewards: {
            "minecraft:stone": 5,
            "minecraft:coal_ore": 15,
            "minecraft:iron_ore": 15,
            "minecraft:gold_ore": 15,
            "minecraft:diamond_ore": 15,
            "minecraft:emerald_ore": 15,
            "minecraft:deepslate_coal_ore": 20,
            "minecraft:deepslate_iron_ore": 20,
            "minecraft:deepslate_gold_ore": 30,
            "minecraft:deepslate_diamond_ore": 50,
            "minecraft:deepslate_emerald_ore": 50
        }
    },
    hunter: {
        name: "狩人",
        mobRewards: {
            "minecraft:zombie": 20,
            "minecraft:skeleton": 20,
            "minecraft:creeper": 30,
            "minecraft:spider": 15,
            "minecraft:enderman": 50,
            "minecraft:witch": 40,
            "minecraft:slime": 10
        }
    },
    lumberjack: {
        name: "木こり",
        blockRewards: {
            "minecraft:oak_log": 10,
            "minecraft:birch_log": 10,
            "minecraft:spruce_log": 10,
            "minecraft:jungle_log": 12,
            "minecraft:acacia_log": 12,
            "minecraft:dark_oak_log": 15,
            "minecraft:mangrove_log": 15,
            "minecraft:cherry_log": 15
        }
    }
    ,
    farmer: {
        name: "農夫",
        blockRewards: {
            "minecraft:wheat": 5,
            "minecraft:carrots": 5,
            "minecraft:potatoes": 5,
            "minecraft:beetroot": 5,
            "minecraft:farmland": 1
        },
        mobRewards: {
            "minecraft:cow": 10,
            "minecraft:pig": 8,
            "minecraft:sheep": 8,
            "minecraft:chicken": 6
        }
    },
    netherdigger: {
        name: "ネザー採掘者",
        blockRewards: {
            "minecraft:netherrack": 3,
            "minecraft:basalt": 4,
            "minecraft:blackstone": 8,
            "minecraft:ancient_debris": 200
        },
        mobRewards: {
            "minecraft:ghast": 80,
            "minecraft:zombified_piglin": 10,
            "minecraft:blaze": 60
        }
    },
    builder: {
        name: "建築者",
        blockRewards: {
            // 建築で使うブロックを壊す/設置で報酬を変える運用も可能
            "minecraft:stone": 1,
            "minecraft:brick": 5,
            "minecraft:planks": 2,
            "minecraft:glass": 3
        }
    }
};