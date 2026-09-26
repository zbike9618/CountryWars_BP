import { world, system, ItemStack } from "@minecraft/server";
import { blockInteractCallbacks } from "../utils/resister.js";
import { ChestFormData } from "../utils/chest_shop/chest-ui.js";
import { itemIdToPath } from "../config/texture_config.js";
import { Util } from "../utils/util.js";

// アイテムごとの5大ステータス基準設定 (パワー, ライフ, スピード, 持続時間, 純度/特殊)
const INGREDIENT_STATS = {
    "minecraft:nether_wart": { power: 10, life: 10, speed: 10, duration: 15, purity: 10 },
    "minecraft:redstone": { power: 0, life: 0, speed: 0, duration: 35, purity: 10 },
    "minecraft:glowstone_dust": { power: 25, life: 15, speed: 0, duration: -5, purity: 10 },
    "minecraft:sugar": { power: 5, life: 0, speed: 35, duration: 10, purity: 5 },
    "minecraft:glistering_melon_slice": { power: 0, life: 40, speed: 0, duration: 10, purity: 15 },
    "minecraft:golden_carrot": { power: 10, life: 20, speed: 0, duration: 20, purity: 40 },
    "minecraft:blaze_powder": { power: 45, life: 5, speed: 10, duration: 10, purity: 0 },
    "minecraft:magma_cream": { power: 15, life: 25, speed: 0, duration: 25, purity: 35 },
    "minecraft:rabbit_foot": { power: 5, life: 10, speed: 45, duration: 15, purity: 15 },
    "minecraft:fermented_spider_eye": { power: 35, life: -25, speed: 0, duration: 15, purity: -40 },
    "minecraft:spider_eye": { power: 20, life: -15, speed: 0, duration: 10, purity: -20 },
    "minecraft:ghast_tear": { power: 15, life: 60, speed: 0, duration: 30, purity: 20 },
    "minecraft:pufferfish": { power: 10, life: -10, speed: 0, duration: 20, purity: 45 },
    "minecraft:phantom_membrane": { power: 10, life: 15, speed: 30, duration: 20, purity: 25 },
    "minecraft:golden_apple": { power: 30, life: 70, speed: 15, duration: 35, purity: 50 },
    "minecraft:enchanted_golden_apple": { power: 70, life: 120, speed: 30, duration: 60, purity: 90 },
    "minecraft:diamond": { power: 50, life: 30, speed: 10, duration: 20, purity: 20 },
    "minecraft:emerald": { power: 25, life: 25, speed: 25, duration: 25, purity: 25 },
    "minecraft:iron_ingot": { power: 20, life: 20, speed: 0, duration: 10, purity: 5 },
    "minecraft:gold_ingot": { power: 15, life: 25, speed: 10, duration: 15, purity: 20 },
    "minecraft:copper_ingot": { power: 10, life: 10, speed: 5, duration: 10, purity: 5 },
    "minecraft:gunpowder": { power: 20, life: 0, speed: 10, duration: 10, purity: 10, isSplash: true },
    "minecraft:dragon_breath": { power: 35, life: 35, speed: 35, duration: 40, purity: 35 },
    "minecraft:rotten_flesh": { power: 15, life: -15, speed: 0, duration: 15, purity: -15 },
    "minecraft:bone": { power: 15, life: 5, speed: 15, duration: 10, purity: 0 },
    "minecraft:honey_bottle": { power: 0, life: 30, speed: 10, duration: 15, purity: 30 },
    "minecraft:apple": { power: 5, life: 15, speed: 5, duration: 10, purity: 10 },
    "minecraft:sweet_berries": { power: 0, life: 10, speed: 10, duration: 10, purity: 5 }
};

// 未登録アイテムのデフォルト基準値
function getIngredientStats(typeId) {
    if (INGREDIENT_STATS[typeId]) return INGREDIENT_STATS[typeId];
    return { power: 5, life: 5, speed: 5, duration: 5, purity: 5 };
}

/**
 * 投入された材料から5大ステータスと各種効果を計算
 * @param {string[]} potionData 
 */
function calculatePotion(potionData) {
    let stats = { power: 0, life: 0, speed: 0, duration: 0, purity: 0, isSplash: false };

    for (const itemTypeId of potionData) {
        if (!itemTypeId) continue;
        const s = getIngredientStats(itemTypeId);
        stats.power += s.power;
        stats.life += s.life;
        stats.speed += s.speed;
        stats.duration += s.duration;
        stats.purity += s.purity;
        if (s.isSplash) stats.isSplash = true;
    }

    // 基本持続時間 (秒)
    const durationSec = Math.max(10, Math.min(300, Math.floor(stats.duration * 1.5)));

    const allEffects = [];

    // --- ① パワー系 (Power Effects) ---
    // レベル I (単一基本条件)
    if (stats.power >= 20) {
        allEffects.push({ id: "strength", name: "攻撃力上昇 I", amp: 0, duration: durationSec, score: stats.power });
    }
    // レベル II (複合条件: パワー + 純度 + 持続時間)
    if (stats.power >= 60 && stats.purity >= 30 && stats.duration >= 30) {
        allEffects.push({ id: "strength", name: "攻撃力上昇 II", amp: 1, duration: durationSec, score: stats.power + 25 });
    }
    if (stats.power >= 50 && stats.life >= 30 && stats.purity >= 30) {
        allEffects.push({ id: "resistance", name: "耐性 I", amp: 0, duration: durationSec, score: stats.power + 20 });
    }
    // レベル III (高難易度極致条件: パワー + ライフ + 純度 + 持続時間)
    if (stats.power >= 100 && stats.purity >= 60 && stats.life >= 40 && stats.duration >= 40) {
        allEffects.push({ id: "strength", name: "攻撃力上昇 III", amp: 2, duration: durationSec, score: stats.power + 50 });
    }
    if (stats.power >= 80 && stats.life >= 60 && stats.purity >= 50) {
        allEffects.push({ id: "resistance", name: "耐性 II", amp: 1, duration: durationSec, score: stats.power + 40 });
    }

    // --- ② ライフ系 (Life Effects) ---
    // レベル I (単一基本条件)
    if (stats.life >= 20) {
        allEffects.push({ id: "instant_health", name: "即時回復 I", amp: 0, duration: 1, score: stats.life });
    }
    // レベル II (複合条件: ライフ + 純度 / 持続時間)
    if (stats.life >= 50 && stats.purity >= 30) {
        allEffects.push({ id: "regeneration", name: "再生能力 I", amp: 0, duration: durationSec, score: stats.life + 20 });
    }
    if (stats.life >= 60 && stats.power >= 30 && stats.purity >= 40) {
        allEffects.push({ id: "instant_health", name: "即時回復 II", amp: 1, duration: 1, score: stats.life + 25 });
    }
    if (stats.life >= 50 && stats.duration >= 40) {
        allEffects.push({ id: "absorption", name: "衝撃吸収 I", amp: 0, duration: durationSec, score: stats.life + 15 });
    }
    // レベル III (高難易度極致条件)
    if (stats.life >= 100 && stats.purity >= 60 && stats.duration >= 50) {
        allEffects.push({ id: "regeneration", name: "再生能力 II", amp: 1, duration: durationSec, score: stats.life + 50 });
    }
    if (stats.life >= 90 && stats.power >= 50 && stats.duration >= 40) {
        allEffects.push({ id: "absorption", name: "衝撃吸収 II", amp: 1, duration: durationSec, score: stats.life + 40 });
    }

    // --- ③ スピード系 (Speed Effects) ---
    // レベル I (単一基本条件)
    if (stats.speed >= 20) {
        allEffects.push({ id: "speed", name: "移動速度上昇 I", amp: 0, duration: durationSec, score: stats.speed });
    }
    // レベル II (複合条件: スピード + 純度 / ライフ)
    if (stats.speed >= 60 && stats.purity >= 30 && stats.duration >= 30) {
        allEffects.push({ id: "speed", name: "移動速度上昇 II", amp: 1, duration: durationSec, score: stats.speed + 25 });
    }
    if (stats.speed >= 50 && stats.life >= 30) {
        allEffects.push({ id: "jump_boost", name: "跳躍力上昇 I", amp: 0, duration: durationSec, score: stats.speed + 15 });
    }
    // レベル III (高難易度極致条件)
    if (stats.speed >= 100 && stats.purity >= 60 && stats.life >= 40) {
        allEffects.push({ id: "speed", name: "移動速度上昇 III", amp: 2, duration: durationSec, score: stats.speed + 50 });
    }
    if (stats.speed >= 80 && stats.power >= 40 && stats.purity >= 40) {
        allEffects.push({ id: "jump_boost", name: "跳躍力上昇 II", amp: 1, duration: durationSec, score: stats.speed + 40 });
    }

    // --- ④ 純度・特殊・ユーティリティ系 (Purity & Special Effects) ---
    // レベル I (単一基本条件)
    if (stats.purity >= 20) {
        allEffects.push({ id: "invisibility", name: "透明化 I", amp: 0, duration: durationSec, score: stats.purity });
    }
    // レベル II (複合条件)
    if (stats.purity >= 40 && stats.life >= 20) {
        allEffects.push({ id: "fire_resistance", name: "耐火 I", amp: 0, duration: durationSec, score: stats.purity + 15 });
    }
    if (stats.purity >= 50 && stats.duration >= 30) {
        allEffects.push({ id: "night_vision", name: "暗視 I", amp: 0, duration: durationSec, score: stats.purity + 10 });
    }

    // --- ⑤ デバフ (負の純度 / 不純調合) ---
    if (stats.purity <= -20 && stats.power >= 20) {
        allEffects.push({ id: "poison", name: "毒 I", amp: 0, duration: Math.floor(durationSec / 2), score: Math.abs(stats.purity) });
    }
    if (stats.purity <= -50 && stats.power >= 50) {
        allEffects.push({ id: "wither", name: "衰弱 II", amp: 1, duration: Math.floor(durationSec / 2), score: Math.abs(stats.purity) + 30 });
    }

    // ステータス強度の高い順にソートし、上位最大2つを抽出
    allEffects.sort((a, b) => b.score - a.score);
    const effects = allEffects.slice(0, 2);

    // 総合評価ランク
    const totalScore = stats.power + stats.life + stats.speed + stats.duration + Math.abs(stats.purity);
    let rank = "C";
    let rankColor = "§7";
    if (totalScore >= 300) { rank = "EX"; rankColor = "§d§l"; }
    else if (totalScore >= 200) { rank = "S"; rankColor = "§e§l"; }
    else if (totalScore >= 120) { rank = "A"; rankColor = "§b"; }
    else if (totalScore >= 60) { rank = "B"; rankColor = "§a"; }

    return { stats, durationSec, effects, totalScore, rank, rankColor };
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
 * @param {string[]} potionData 
 */
async function _showForm(player, potionData = []) {
    const form = new ChestFormData("large");
    form.setTitle("§l§d【ポーション錬成調合台】§r");

    const calc = calculatePotion(potionData);

    // スロット 0: 完成品プレビュー
    const previewLore = [
        `§e=== 5大調合ステータス ===`,
        `§c パワー: ${calc.stats.power}`,
        `§a ライフ: ${calc.stats.life}`,
        `§b スピード: ${calc.stats.speed}`,
        `§e 持続時間: ${calc.durationSec}秒 (最大300秒)`,
        `§d 純度: ${calc.stats.purity}`,
        `§7-----------------------`,
        `§6=== 発動予定効果 (上位最大2個) ===`
    ];

    if (calc.effects.length === 0) {
        previewLore.push(`§7(効果なし - 材料を追加してください)`);
    } else {
        for (const ef of calc.effects) {
            previewLore.push(`§f ・ ${ef.name}`);
        }
    }

    form.setButton(0, {
        iconPath: itemIdToPath[calc.stats.isSplash ? "minecraft:splash_potion" : "minecraft:potion"],
        name: `${calc.rankColor}★ 特製秘薬 [Rank ${calc.rank}]§r`,
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
            `§e※インベントリに「ガラス瓶」が必要です`
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
        const matTypeId = potionData[i];
        if (matTypeId) {
            const st = getIngredientStats(matTypeId);
            form.setButton(i + 4, {
                iconPath: itemIdToPath[matTypeId] || itemIdToPath["minecraft:paper"],
                name: `§e材料${i + 1}: ${Util.langChangeItemName(matTypeId)}§r`,
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

        // ガラス瓶チェック
        let bottleSlot = -1;
        if (inventory) {
            for (let i = 0; i < inventory.size; i++) {
                const it = inventory.getItem(i);
                if (it && it.typeId === "minecraft:glass_bottle") {
                    bottleSlot = i;
                    break;
                }
            }
        }

        if (bottleSlot === -1) {
            player.sendMessage("§c【錬成エラー】 ポーションを入れる「ガラス瓶 (minecraft:glass_bottle)」がありません！");
            return;
        }

        // ガラス瓶消費
        const bItem = inventory.getItem(bottleSlot);
        if (bItem.amount > 1) {
            bItem.amount -= 1;
            inventory.setItem(bottleSlot, bItem);
        } else {
            inventory.setItem(bottleSlot, undefined);
        }

        // 材料消費
        for (const matTypeId of potionData) {
            for (let i = 0; i < inventory.size; i++) {
                const it = inventory.getItem(i);
                if (it && it.typeId === matTypeId) {
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

        // ポーション生成
        const potionTypeId = calc.stats.isSplash ? "minecraft:splash_potion" : "minecraft:potion";
        const potionItem = new ItemStack(potionTypeId, 1);
        potionItem.nameTag = `${calc.rankColor}★ 特製錬成秘薬 [Rank ${calc.rank}]§r`;

        const finalLore = [
            `§e=== 5大調合属性 ===`,
            `§c パワー: ${calc.stats.power}`,
            `§a ライフ: ${calc.stats.life}`,
            `§b スピード: ${calc.stats.speed}`,
            `§e 持続時間: ${calc.durationSec}秒`,
            `§d 純度: ${calc.stats.purity}`,
            `§7-----------------------`,
            `§6=== 発動効果 ===`
        ];

        let effectPayload = [];
        if (calc.effects.length === 0) {
            finalLore.push(`§7・効果なし`);
        } else {
            for (const ef of calc.effects) {
                finalLore.push(`§f ・ ${ef.name}`);
                effectPayload.push(`${ef.id}:${ef.amp}:${Math.min(300, ef.duration)}`);
            }
        }
        finalLore.push(`§7-----------------------`);
        finalLore.push(`§8[CW_POTION_DATA:${effectPayload.join("|")}]`);

        potionItem.setLore(finalLore);

        const leftover = inventory.addItem(potionItem);
        if (leftover) {
            player.dimension.spawnItem(leftover, player.location);
        }

        player.playSound("random.glass", { volume: 1.0, pitch: 1.2 });
        player.playSound("random.levelup", { volume: 0.8, pitch: 1.5 });
        player.sendMessage(`§a✨ 【錬成成功】 ${calc.rankColor}Rank ${calc.rank} §aの特製ポーションを完成させました！`);
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
                potionData.push(selectedItem.typeId);
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

        const rawData = dataLine.replace("§8[CW_POTION_DATA:", "").replace("]", "").trim();
        if (!rawData) return;

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