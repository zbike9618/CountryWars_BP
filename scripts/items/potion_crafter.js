import { world, system, ItemStack } from "@minecraft/server";
import { blockInteractCallbacks } from "../utils/resister.js";
import { ChestFormData } from "../utils/chest_shop/chest-ui.js";
import { itemIdToPath } from "../config/texture_config.js";
import { Util } from "../utils/util.js";

// アイテムごとの5大ステータス基準設定 (パワー, ライフ, スピード, 持続時間, 純度/特殊)
const INGREDIENT_STATS = {
    "minecraft:nether_wart": { power: 15, life: 10, speed: -5, duration: 20, purity: -10 },
    "minecraft:redstone": { power: -10, life: -5, speed: -5, duration: 40, purity: 10 },
    "minecraft:glowstone_dust": { power: 30, life: 15, speed: -10, duration: -20, purity: 10 },
    "minecraft:sugar": { power: -5, life: -15, speed: 45, duration: 15, purity: -10 },
    "minecraft:glistering_melon_slice": { power: -15, life: 45, speed: -5, duration: 15, purity: 20 },
    "minecraft:golden_carrot": { power: -10, life: 25, speed: -10, duration: 25, purity: 45 },
    "minecraft:blaze_powder": { power: 50, life: -10, speed: 10, duration: -15, purity: -20 },
    "minecraft:magma_cream": { power: 20, life: 30, speed: -20, duration: 30, purity: 25 },
    "minecraft:rabbit_foot": { power: -15, life: -10, speed: 50, duration: 20, purity: 10 },
    "minecraft:fermented_spider_eye": { power: 40, life: -35, speed: -15, duration: 20, purity: -50 },
    "minecraft:spider_eye": { power: 25, life: -25, speed: -10, duration: 15, purity: -30 },
    "minecraft:ghast_tear": { power: -20, life: 65, speed: -15, duration: 35, purity: 25 },
    "minecraft:pufferfish": { power: 15, life: -20, speed: -15, duration: 25, purity: 50 },
    "minecraft:phantom_membrane": { power: -10, life: 15, speed: 35, duration: -15, purity: 25 },
    "minecraft:golden_apple": { power: 35, life: 75, speed: -15, duration: 40, purity: 55 },
    "minecraft:enchanted_golden_apple": { power: 75, life: 125, speed: -20, duration: 65, purity: 95 },
    "minecraft:diamond": { power: 55, life: -15, speed: -10, duration: 25, purity: 25 },
    "minecraft:emerald": { power: 30, life: 30, speed: 30, duration: -20, purity: -10 },
    "minecraft:iron_ingot": { power: 25, life: 25, speed: -20, duration: 15, purity: -10 },
    "minecraft:gold_ingot": { power: -10, life: 30, speed: 15, duration: 20, purity: 25 },
    "minecraft:copper_ingot": { power: 15, life: -10, speed: 10, duration: 15, purity: -15 },
    "minecraft:gunpowder": { power: 25, life: -20, speed: 15, duration: -15, purity: -20, isSplash: true },
    "minecraft:dragon_breath": { power: 40, life: 40, speed: 40, duration: 45, purity: -30 },
    "minecraft:rotten_flesh": { power: 20, life: -25, speed: -10, duration: 15, purity: -25 },
    "minecraft:bone": { power: 20, life: -10, speed: 20, duration: -10, purity: -10 },
    "minecraft:honey_bottle": { power: -15, life: 35, speed: -25, duration: 20, purity: 35 },
    "minecraft:apple": { power: -5, life: 20, speed: 5, duration: 10, purity: -5 },
    "minecraft:sweet_berries": { power: -5, life: 15, speed: -10, duration: 10, purity: 5 },
    "cw:mana_rose": { power: 25, life: 25, speed: 20, duration: 35, purity: 45 }
};

// 未登録アイテムのデフォルト基準値
function getIngredientStats(typeId) {
    if (INGREDIENT_STATS[typeId]) return INGREDIENT_STATS[typeId];
    return { power: 5, life: 5, speed: -5, duration: 5, purity: -5 };
}

/**
 * 投入された材料 (通常材料 or 特製ポーション) から5大ステータスと各種効果を計算
 * @param {Array<{typeId: string, isPotion?: boolean, potionData?: any}>} selectedIngredients 
 */
function parsePotionData(item) {
    if (!item) return null;
    const lore = item.getLore();
    if (!lore || lore.length === 0) return null;

    const dataLine = lore.find(line => line.includes("[CW_POTION_DATA:"));
    if (!dataLine) return null;

    let rawData = dataLine.replace("§8[CW_POTION_DATA:", "").replace("]", "").trim();
    if (!rawData) return null;

    let stage = 1;
    let effectPayload = rawData;

    // "2:strength:1:180|..." から Stage 番号を取得
    const firstColonIdx = rawData.indexOf(":");
    if (firstColonIdx !== -1) {
        const potentialStage = parseInt(rawData.substring(0, firstColonIdx));
        if (!isNaN(potentialStage) && potentialStage >= 1 && potentialStage <= 3) {
            stage = potentialStage;
            effectPayload = rawData.substring(firstColonIdx + 1);
        }
    }

    // Lore から元の5大ステータスを読み取り（存在する場合）
    let stats = { power: 20 * stage, life: 20 * stage, speed: 20 * stage, duration: 20 * stage, purity: 20 * stage };

    for (const line of lore) {
        if (line.includes("パワー:")) {
            const val = parseInt(line.split("パワー:")[1]);
            if (!isNaN(val)) stats.power = val;
        }
        if (line.includes("ライフ:")) {
            const val = parseInt(line.split("ライフ:")[1]);
            if (!isNaN(val)) stats.life = val;
        }
        if (line.includes("スピード:")) {
            const val = parseInt(line.split("スピード:")[1]);
            if (!isNaN(val)) stats.speed = val;
        }
        if (line.includes("持続時間:")) {
            const val = parseInt(line.split("持続時間:")[1]);
            if (!isNaN(val)) stats.duration = Math.floor(val / 1.5);
        }
        if (line.includes("純度:")) {
            const val = parseInt(line.split("純度:")[1]);
            if (!isNaN(val)) stats.purity = val;
        }
    }

    const carriedEffects = [];
    if (effectPayload && effectPayload !== "none") {
        const entries = effectPayload.split("|");
        for (const entry of entries) {
            const [id, ampStr, durStr] = entry.split(":");
            if (!id) continue;
            const amp = parseInt(ampStr) || 0;
            const dur = parseInt(durStr) || 30;
            carriedEffects.push({ id, amp, duration: dur });
        }
    }

    return { stage, effectPayload, carriedEffects, stats };
}

function calculatePotion(selectedIngredients = []) {
    let stats = { power: 0, life: 0, speed: 0, duration: 0, purity: 0, isSplash: false };
    let maxInputStage = 0;
    const carriedEffectsList = [];

    for (const item of selectedIngredients) {
        if (!item) continue;
        if (item.isPotion && item.potionData) {
            const pData = item.potionData;
            if (pData.stage > maxInputStage) {
                maxInputStage = pData.stage;
            }
            // ポーション投入によるステータス継承・ボーナス加算
            stats.power += Math.floor(pData.stats.power * 0.6) + 20;
            stats.life += Math.floor(pData.stats.life * 0.6) + 20;
            stats.speed += Math.floor(pData.stats.speed * 0.6) + 20;
            stats.duration += Math.floor(pData.stats.duration * 0.6) + 25;
            stats.purity += Math.floor(pData.stats.purity * 0.6) + 15;

            if (item.typeId === "minecraft:splash_potion") {
                stats.isSplash = true;
            }

            for (const ef of pData.carriedEffects) {
                carriedEffectsList.push(ef);
            }
        } else {
            const s = getIngredientStats(item.typeId);
            stats.power += s.power;
            stats.life += s.life;
            stats.speed += s.speed;
            stats.duration += s.duration;
            stats.purity += s.purity;
            if (s.isSplash) stats.isSplash = true;
        }
    }

    // 現在の錬成段階 (1, 2, または 3)
    const currentStage = Math.min(3, maxInputStage + 1);

    // 基本持続時間 (秒)
    const durationSec = Math.max(10, Math.min(300, Math.floor(stats.duration * 1.5)));

    const allEffects = [];

    const effectNames = {
        "strength": "攻撃力上昇",
        "resistance": "耐性",
        "instant_health": "即時回復",
        "regeneration": "再生能力",
        "absorption": "衝撃吸収",
        "speed": "移動速度上昇",
        "jump_boost": "跳躍力上昇",
        "invisibility": "透明化",
        "fire_resistance": "耐火",
        "night_vision": "暗視",
        "poison": "毒",
        "wither": "衰弱"
    };

    const getAmpRoman = (amp) => {
        if (amp === 0) return "I";
        if (amp === 1) return "II";
        if (amp === 2) return "III";
        return `${amp + 1}`;
    };

    // 継承された効果の追加
    for (const ef of carriedEffectsList) {
        const nameBase = effectNames[ef.id] || ef.id;
        const roman = getAmpRoman(ef.amp);
        const name = `${nameBase} ${roman}`;
        const baseScore = (ef.amp + 1) * 45 + (ef.duration > 1 ? 25 : 0);
        allEffects.push({
            id: ef.id,
            name: name,
            amp: ef.amp,
            duration: Math.max(ef.duration, durationSec),
            score: baseScore
        });
    }

    // --- ① パワー系 (Power Effects) ---
    if (stats.power >= 35 && stats.purity >= 10) {
        allEffects.push({ id: "strength", name: "攻撃力上昇 I", amp: 0, duration: durationSec, score: stats.power });
    }
    if (stats.power >= 80 && stats.purity >= 40 && stats.duration >= 30) {
        allEffects.push({ id: "strength", name: "攻撃力上昇 II", amp: 1, duration: durationSec, score: stats.power + 30 });
    }
    if (stats.power >= 70 && stats.life >= 40 && stats.purity >= 30) {
        allEffects.push({ id: "resistance", name: "耐性 I", amp: 0, duration: durationSec, score: stats.power + 25 });
    }
    if (stats.power >= 140 && stats.purity >= 70 && stats.life >= 50 && stats.duration >= 50) {
        allEffects.push({ id: "strength", name: "攻撃力上昇 III", amp: 2, duration: durationSec, score: stats.power + 80 });
    }
    if (stats.power >= 110 && stats.life >= 80 && stats.purity >= 60 && stats.duration >= 40) {
        allEffects.push({ id: "resistance", name: "耐性 II", amp: 1, duration: durationSec, score: stats.power + 60 });
    }

    // --- ② ライフ系 (Life Effects) ---
    if (stats.life >= 35 && stats.purity >= 10) {
        allEffects.push({ id: "instant_health", name: "即時回復 I", amp: 0, duration: 1, score: stats.life });
    }
    if (stats.life >= 70 && stats.purity >= 40 && stats.duration >= 30) {
        allEffects.push({ id: "regeneration", name: "再生能力 I", amp: 0, duration: durationSec, score: stats.life + 30 });
    }
    if (stats.life >= 90 && stats.power >= 40 && stats.purity >= 50) {
        allEffects.push({ id: "instant_health", name: "即時回復 II", amp: 1, duration: 1, score: stats.life + 35 });
    }
    if (stats.life >= 75 && stats.duration >= 50 && stats.power >= 30) {
        allEffects.push({ id: "absorption", name: "衝撃吸収 I", amp: 0, duration: durationSec, score: stats.life + 25 });
    }
    if (stats.life >= 140 && stats.purity >= 70 && stats.duration >= 60 && stats.power >= 40) {
        allEffects.push({ id: "regeneration", name: "再生能力 II", amp: 1, duration: durationSec, score: stats.life + 80 });
    }
    if (stats.life >= 120 && stats.power >= 70 && stats.duration >= 50 && stats.purity >= 50) {
        allEffects.push({ id: "absorption", name: "衝撃吸収 II", amp: 1, duration: durationSec, score: stats.life + 60 });
    }

    // --- ③ スピード系 (Speed Effects) ---
    if (stats.speed >= 35 && stats.purity >= 10) {
        allEffects.push({ id: "speed", name: "移動速度上昇 I", amp: 0, duration: durationSec, score: stats.speed });
    }
    if (stats.speed >= 80 && stats.purity >= 40 && stats.duration >= 40) {
        allEffects.push({ id: "speed", name: "移動速度上昇 II", amp: 1, duration: durationSec, score: stats.speed + 30 });
    }
    if (stats.speed >= 70 && stats.life >= 40 && stats.purity >= 30) {
        allEffects.push({ id: "jump_boost", name: "跳躍力上昇 I", amp: 0, duration: durationSec, score: stats.speed + 25 });
    }
    if (stats.speed >= 140 && stats.purity >= 70 && stats.life >= 50 && stats.duration >= 50) {
        allEffects.push({ id: "speed", name: "移動速度上昇 III", amp: 2, duration: durationSec, score: stats.speed + 80 });
    }
    if (stats.speed >= 110 && stats.power >= 60 && stats.purity >= 50 && stats.duration >= 40) {
        allEffects.push({ id: "jump_boost", name: "跳躍力上昇 II", amp: 1, duration: durationSec, score: stats.speed + 60 });
    }

    // --- ④ 純度・特殊・ユーティリティ系 ---
    if (stats.purity >= 35 && stats.duration >= 20) {
        allEffects.push({ id: "invisibility", name: "透明化 I", amp: 0, duration: durationSec, score: stats.purity });
    }
    if (stats.purity >= 55 && stats.life >= 30 && stats.duration >= 30) {
        allEffects.push({ id: "fire_resistance", name: "耐火 I", amp: 0, duration: durationSec, score: stats.purity + 20 });
    }
    if (stats.purity >= 60 && stats.duration >= 40) {
        allEffects.push({ id: "night_vision", name: "暗視 I", amp: 0, duration: durationSec, score: stats.purity + 15 });
    }

    // --- ⑤ 神話級全ステータス極致条件 (Mythic Composite Effects) ---
    if (stats.power >= 90 && stats.life >= 90 && stats.speed >= 90 && stats.purity >= 80 && stats.duration >= 60) {
        allEffects.push({ id: "regeneration", name: "神秘の加護 (再生能力 II)", amp: 1, duration: durationSec, score: 350 });
        allEffects.push({ id: "resistance", name: "不滅の防壁 (耐性 II)", amp: 1, duration: durationSec, score: 340 });
    }

    // --- ⑥ デバフ (負の純度 / 不純調合) ---
    if (stats.purity <= -20) {
        allEffects.push({ id: "poison", name: "毒 I", amp: 0, duration: Math.floor(durationSec / 2), score: Math.abs(stats.purity) });
    }
    if (stats.purity <= -50 && stats.power >= 40) {
        allEffects.push({ id: "poison", name: "毒 II", amp: 1, duration: Math.floor(durationSec / 2), score: Math.abs(stats.purity) + 20 });
    }
    if (stats.purity <= -70) {
        allEffects.push({ id: "wither", name: "衰弱 II", amp: 1, duration: Math.floor(durationSec / 2), score: Math.abs(stats.purity) + 50 });
    }

    // 同一IDのエフェクトの重複排除 (スコアが高い方を優先)
    const effectMap = new Map();
    for (const ef of allEffects) {
        const existing = effectMap.get(ef.id);
        if (!existing || ef.score > existing.score) {
            effectMap.set(ef.id, ef);
        }
    }

    const uniqueEffects = Array.from(effectMap.values());
    uniqueEffects.sort((a, b) => b.score - a.score);

    // ★ 重ねても【最大2個】までに制限
    const effects = uniqueEffects.slice(0, 2);

    // 総合評価ランク計算
    const totalScore = stats.power + stats.life + stats.speed + stats.duration + Math.abs(stats.purity);
    let rank = "C";
    let rankColor = "§7";

    // ★ 3回目 (Stage 3) でしか EX ランクにならない制限
    if (totalScore >= 300) {
        if (currentStage === 3) {
            rank = "EX";
            rankColor = "§d§l";
        } else {
            rank = "S";
            rankColor = "§e§l";
        }
    } else if (totalScore >= 200) {
        rank = "S";
        rankColor = "§e§l";
    } else if (totalScore >= 120) {
        rank = "A";
        rankColor = "§b";
    } else if (totalScore >= 60) {
        rank = "B";
        rankColor = "§a";
    }

    return { stats, durationSec, effects, totalScore, rank, rankColor, currentStage };
}

// ブロックインタラクト登録
blockInteractCallbacks.push((arg) => {
    /** @type {import("@minecraft/server").BlockComponentPlayerInteractEvent} */
    const e = arg;
    if (e.block.typeId == "cw:potion_crafter") {
        _showForm(e.player);
    }
});

/**
 * ポーション調合UIの表示
 * @param {import("@minecraft/server").Player} player 
 * @param {Array<{typeId: string, isPotion?: boolean, potionData?: any, invSlot?: number}>} potionData 
 */
async function _showForm(player, potionData = []) {
    const form = new ChestFormData("large");
    form.setTitle("§l§d【ポーション錬成調合台】§r");

    const calc = calculatePotion(potionData);

    // スロット 0: 完成品プレビュー
    const previewLore = [
        `§e=== 5大調合ステータス (Stage ${calc.currentStage}/3) ===`,
        `§c パワー: ${calc.stats.power}`,
        `§a ライフ: ${calc.stats.life}`,
        `§b スピード: ${calc.stats.speed}`,
        `§e 持続時間: ${calc.durationSec}秒`,
        `§d 純度: ${calc.stats.purity}`,
        `§7-----------------------`,
        `§6=== 発動予定効果 (最大2個) ===`
    ];

    if (calc.effects.length === 0) {
        previewLore.push(`§7(効果なし - 材料を追加してください)`);
    } else {
        for (const ef of calc.effects) {
            previewLore.push(`§f ・ ${ef.name}`);
        }
    }

    if (calc.currentStage < 3 && calc.totalScore >= 300) {
        previewLore.push(`§7-----------------------`);
        previewLore.push(`§c※EXランク解放条件: Stage 3(3回目の再錬成)が必要`);
    }

    form.setButton(0, {
        iconPath: itemIdToPath[calc.stats.isSplash ? "minecraft:splash_potion" : "minecraft:potion"],
        name: `${calc.rankColor}★ 特製秘薬 Stage ${calc.currentStage} [Rank ${calc.rank}]§r`,
        stackAmount: 1,
        lore: previewLore,
        editedName: true,
        isGlint: potionData.length > 0
    });

    // スロット 1: 調合執行ボタン
    form.setButton(1, {
        iconPath: itemIdToPath["minecraft:brewing_stand"],
        name: "§a§l🧪 ポーションを調合する§r",
        lore: [
            `§7現在の材料(${potionData.length}/5)で調合を開始します`,
            `§e※ポーション以外の材料使用時は「ガラス瓶」が必要です`
        ],
        stackAmount: 1,
        editedName: true
    });

    // スロット 2: リセットボタン
    form.setButton(2, {
        iconPath: itemIdToPath["minecraft:barrier"],
        name: "§c§l🗑️ 材料をリセット§r",
        lore: ["§7選択中の材料をすべてリセットします"],
        stackAmount: 1,
        editedName: true
    });

    // スロット 3: 区切り
    form.setButton(3, {
        iconPath: itemIdToPath["minecraft:glass_pane"] || itemIdToPath["minecraft:barrier"],
        name: "§7---",
        stackAmount: 1,
        editedName: true
    });

    // スロット 4〜8: 投入中材料 (最大5個)
    for (let i = 0; i < 5; i++) {
        const itemData = potionData[i];
        if (itemData) {
            if (itemData.isPotion) {
                form.setButton(i + 4, {
                    iconPath: itemIdToPath[itemData.typeId] || itemIdToPath["minecraft:potion"],
                    name: `§d材料${i + 1}: 特製ポーション (Stage ${itemData.potionData.stage})§r`,
                    lore: [
                        `§e・継承効果数: ${itemData.potionData.carriedEffects.length}個`,
                        `§c<タップで取り外す>`
                    ],
                    stackAmount: 1,
                    editedName: true
                });
            } else {
                const st = getIngredientStats(itemData.typeId);
                form.setButton(i + 4, {
                    iconPath: itemIdToPath[itemData.typeId] || itemIdToPath["minecraft:paper"],
                    name: `§e材料${i + 1}: ${Util.langChangeItemName(itemData.typeId)}§r`,
                    lore: [
                        `§7・パワー: +${st.power}`,
                        `§7・ライフ: +${st.life}`,
                        `§7・スピード: +${st.speed}`,
                        `§7・持続時間: +${st.duration}`,
                        `§7・純度: +${st.purity}`,
                        `§c<タップで取り外す>`
                    ],
                    stackAmount: 1,
                    editedName: true
                });
            }
        } else {
            form.setButton(i + 4, {
                iconPath: itemIdToPath["minecraft:barrier"],
                name: `§7材料スロット ${i + 1} (空き)`,
                lore: ["§7下のインベントリからタップして追加"],
                stackAmount: 1,
                editedName: true
            });
        }
    }

    // スロット 9〜17: 仕切りヘッダー
    for (let i = 9; i < 18; i++) {
        form.setButton(i, {
            iconPath: itemIdToPath["minecraft:glass_pane"] || itemIdToPath["minecraft:barrier"],
            name: "§8↓ 下のインベントリから材料をタップ ↓",
            stackAmount: 1,
            editedName: true
        });
    }

    // スロット 18〜53: インベントリ表示
    const inventory = player.getComponent("inventory")?.container;
    const invItems = [];
    if (inventory) {
        for (let i = 0; i < 36; i++) {
            const item = inventory.getItem(i);
            const slotIndex = i + 18;
            if (item) {
                invItems[i] = item;
                
                // ポーションアイテムであるかの解析
                if (item.typeId === "minecraft:potion" || item.typeId === "minecraft:splash_potion") {
                    const parsed = parsePotionData(item);
                    if (parsed) {
                        if (parsed.stage >= 3) {
                            form.setButton(slotIndex, {
                                iconPath: itemIdToPath[item.typeId] || itemIdToPath["minecraft:potion"],
                                name: `§c${Util.langChangeItemName(item.typeId)} [Stage 3/3 限界]`,
                                stackAmount: item.amount,
                                lore: [
                                    `§c※Stage 3達成済みのためこれ以上錬成不可`,
                                    `§7これ以上調合台に追加することはできません`
                                ]
                            });
                        } else {
                            form.setButton(slotIndex, {
                                iconPath: itemIdToPath[item.typeId] || itemIdToPath["minecraft:potion"],
                                name: `§d${Util.langChangeItemName(item.typeId)} [Stage ${parsed.stage}/3]`,
                                stackAmount: item.amount,
                                lore: [
                                    `§e★再錬成可能な特製ポーション`,
                                    `§7・現在のStage: ${parsed.stage}`,
                                    `§7・保持効果: ${parsed.carriedEffects.map(e => e.id).join(", ") || "なし"}`,
                                    `§d<タップで再調合材料に追加>`
                                ]
                            });
                        }
                        continue;
                    }
                }

                // 通常材料
                const st = getIngredientStats(item.typeId);
                form.setButton(slotIndex, {
                    iconPath: itemIdToPath[item.typeId] || itemIdToPath["minecraft:paper"],
                    name: Util.langChangeItemName(item.typeId),
                    stackAmount: item.amount,
                    lore: [
                        `§7[5大属性値]`,
                        `§c P:${st.power >= 0 ? '+' : ''}${st.power} §aL:${st.life >= 0 ? '+' : ''}${st.life} §bS:${st.speed >= 0 ? '+' : ''}${st.speed} §eD:${st.duration >= 0 ? '+' : ''}${st.duration} §dP:${st.purity >= 0 ? '+' : ''}${st.purity}`,
                        `§e<タップで調合台に追加>`
                    ]
                });
            }
        }
    }

    const res = await form.show(player);
    if (!res || res.canceled) return;

    const btn = res.selection;

    // ① 調合ボタン (スロット 1)
    if (btn === 1) {
        if (potionData.length === 0) {
            player.sendMessage("§c【錬成エラー】 材料が選ばれていません！インベントリから材料を追加してください。");
            return;
        }

        const hasPotionIngredient = potionData.some(d => d.isPotion);

        // ポーション材料が含まれていない場合はガラス瓶が必要
        let bottleSlot = -1;
        if (!hasPotionIngredient && inventory) {
            for (let i = 0; i < inventory.size; i++) {
                const it = inventory.getItem(i);
                if (it && it.typeId === "minecraft:glass_bottle") {
                    bottleSlot = i;
                    break;
                }
            }
            if (bottleSlot === -1) {
                player.sendMessage("§c【錬成エラー】 ポーションを入れる「ガラス瓶 (minecraft:glass_bottle)」がありません！");
                return;
            }
        }

        // ガラス瓶消費 (必要な場合)
        if (bottleSlot !== -1 && inventory) {
            const bItem = inventory.getItem(bottleSlot);
            if (bItem.amount > 1) {
                bItem.amount -= 1;
                inventory.setItem(bottleSlot, bItem);
            } else {
                inventory.setItem(bottleSlot, undefined);
            }
        }

        // 材料消費
        if (inventory) {
            for (const mat of potionData) {
                if (mat.isPotion && mat.invSlot !== undefined) {
                    const it = inventory.getItem(mat.invSlot);
                    if (it && (it.typeId === "minecraft:potion" || it.typeId === "minecraft:splash_potion")) {
                        if (it.amount > 1) {
                            it.amount -= 1;
                            inventory.setItem(mat.invSlot, it);
                        } else {
                            inventory.setItem(mat.invSlot, undefined);
                        }
                    }
                } else {
                    for (let i = 0; i < inventory.size; i++) {
                        const it = inventory.getItem(i);
                        if (it && it.typeId === mat.typeId) {
                            if (it.amount > 1) {
                                it.amount -= 1;
                                inventory.setItem(i, it);
                            } else {
                                inventory.setItem(i, undefined);
                            }
                            break;
                        }
                    }
                }
            }
        }

        // ポーション生成
        const potionTypeId = calc.stats.isSplash ? "minecraft:splash_potion" : "minecraft:potion";
        const potionItem = new ItemStack(potionTypeId, 1);
        potionItem.nameTag = `${calc.rankColor}★ 特製錬成秘薬 Stage ${calc.currentStage} [Rank ${calc.rank}]§r`;

        const finalLore = [
            `§e=== 5大調合属性 (Stage ${calc.currentStage}/3) ===`,
            `§c パワー: ${calc.stats.power}`,
            `§a ライフ: ${calc.stats.life}`,
            `§b スピード: ${calc.stats.speed}`,
            `§e 持続時間: ${calc.durationSec}秒`,
            `§d 純度: ${calc.stats.purity}`,
            `§7-----------------------`,
            `§6=== 発動効果 (最大2個) ===`
        ];

        let effectPayload = [];
        if (calc.effects.length === 0) {
            finalLore.push(`§7・効果なし`);
            effectPayload.push("none");
        } else {
            for (const ef of calc.effects) {
                finalLore.push(`§f ・ ${ef.name}`);
                effectPayload.push(`${ef.id}:${ef.amp}:${Math.min(300, ef.duration)}`);
            }
        }
        finalLore.push(`§7-----------------------`);
        finalLore.push(`§8[CW_POTION_DATA:${calc.currentStage}:${effectPayload.join("|")}]`);

        potionItem.setLore(finalLore);

        const leftover = inventory.addItem(potionItem);
        if (leftover) {
            player.dimension.spawnItem(leftover, player.location);
        }

        player.playSound("random.glass", { volume: 1.0, pitch: 1.2 });
        player.playSound("random.levelup", { volume: 0.8, pitch: 1.5 });
        player.sendMessage(`§a✨ 【錬成成功】 ${calc.rankColor}Stage ${calc.currentStage} Rank ${calc.rank} §aの特製ポーションを完成させました！`);
        return;
    }

    // ② リセットボタン (スロット 2)
    if (btn === 2) {
        player.sendMessage("§e調合台の材料をリセットしました。");
        _showForm(player, []);
        return;
    }

    // ③ 材料取り外し (スロット 4〜8)
    if (btn >= 4 && btn <= 8) {
        const index = btn - 4;
        if (potionData[index]) {
            potionData.splice(index, 1);
        }
        _showForm(player, potionData);
        return;
    }

    // ④ インベントリ材料選択 (スロット 18〜53)
    if (btn >= 18 && btn <= 53) {
        const invIndex = btn - 18;
        const selectedItem = invItems[invIndex];
        if (selectedItem) {
            if (potionData.length >= 5) {
                player.sendMessage("§c【警告】 材料は最大5個までしか追加できません！");
            } else {
                if (selectedItem.typeId === "minecraft:potion" || selectedItem.typeId === "minecraft:splash_potion") {
                    const parsed = parsePotionData(selectedItem);
                    if (parsed) {
                        if (parsed.stage >= 3) {
                            player.sendMessage("§c【錬成エラー】 Stage 3(限界到達)のポーションはこれ以上再調合できません！");
                        } else {
                            potionData.push({
                                typeId: selectedItem.typeId,
                                isPotion: true,
                                potionData: parsed,
                                invSlot: invIndex
                            });
                        }
                    } else {
                        potionData.push({ typeId: selectedItem.typeId, isPotion: false });
                    }
                } else {
                    potionData.push({ typeId: selectedItem.typeId, isPotion: false });
                }
            }
        }
        _showForm(player, potionData);
        return;
    }
}

// ポーション使用時（飲用・使用時）の効果発動処理
world.afterEvents.itemCompleteUse.subscribe((event) => {
    const player = event.source;
    const item = event.itemStack;
    if (!item) return;

    if (item.typeId === "minecraft:potion" || item.typeId === "minecraft:splash_potion") {
        const lore = item.getLore();
        if (!lore || lore.length === 0) return;

        const dataLine = lore.find(line => line.includes("[CW_POTION_DATA:"));
        if (!dataLine) return;

        let rawData = dataLine.replace("§8[CW_POTION_DATA:", "").replace("]", "").trim();
        if (!rawData) return;

        // Stage プレフィックス ("2:strength:...") を除去
        const firstColonIdx = rawData.indexOf(":");
        if (firstColonIdx !== -1) {
            const potentialStage = parseInt(rawData.substring(0, firstColonIdx));
            if (!isNaN(potentialStage) && potentialStage >= 1 && potentialStage <= 3) {
                rawData = rawData.substring(firstColonIdx + 1);
            }
        }

        if (rawData === "none" || !rawData) return;

        const effectEntries = rawData.split("|");
        for (const entry of effectEntries) {
            const [id, ampStr, durStr] = entry.split(":");
            if (!id) continue;
            const amp = parseInt(ampStr) || 0;
            const dur = parseInt(durStr) || 10;

            if (id === "instant_health") {
                Util.heal(player, (amp + 1) * 12);
            } else {
                player.addEffect(id, dur * 20, {
                    amplifier: amp,
                    showParticles: true
                });
            }
        }

        player.playSound("random.levelup", { volume: 0.5, pitch: 1.8 });
        player.sendMessage("§a✨ 特製ポーションの効能を発動しました！");
    }
});