import * as server from "@minecraft/server";
const { world, system } = server;

// 走査対象となる鉱石のIDと表示名のマッピング
const ORE_NAMES = {
    "minecraft:iron_ore": "鉄鉱石",
    "minecraft:deepslate_iron_ore": "深層鉄鉱石",
    "minecraft:gold_ore": "金鉱石",
    "minecraft:deepslate_gold_ore": "深層金鉱石",
    "minecraft:nether_gold_ore": "ネザー金鉱石",
    "minecraft:copper_ore": "銅鉱石",
    "minecraft:deepslate_copper_ore": "深層銅鉱石",
    "minecraft:diamond_ore": "ダイヤモンド鉱石",
    "minecraft:deepslate_diamond_ore": "深層ダイヤモンド鉱石",
    "minecraft:emerald_ore": "エメラルド鉱石",
    "minecraft:deepslate_emerald_ore": "深層エメラルド鉱石",
    "minecraft:lapis_ore": "ラピスラズリ鉱石",
    "minecraft:deepslate_lapis_ore": "深層ラピスラズリ鉱石",
    "minecraft:redstone_ore": "レッドストーン鉱石",
    "minecraft:deepslate_redstone_ore": "深層レッドストーン鉱石",
    "minecraft:lit_redstone_ore": "レッドストーン鉱石",
    "minecraft:deepslate_lit_redstone_ore": "深層レッドストーン鉱石",
    "minecraft:ancient_debris": "古代の残骸",
    "cw:sulfur_ore": "硫黄鉱石",
    "cw:platinum_ore": "プラチナ鉱石",
    "cw:end_ore": "エンド鉱石"
};

// アイテム使用イベントの監視
world.afterEvents.itemUse.subscribe((event) => {
    const player = event.source;
    const itemStack = event.itemStack;

    if (itemStack.typeId !== "cw:metal_detector") return;

    const startLoc = player.location;
    const dimension = player.dimension;

    let nearestOre = null;
    let minDistance = Infinity;
    const radius = 5; // 探知半径

    for (let dx = -radius; dx <= radius; dx++) {
        for (let dy = -radius; dy <= radius; dy++) {
            for (let dz = -radius; dz <= radius; dz++) {
                const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
                if (dist > radius) continue;

                const checkLoc = {
                    x: Math.floor(startLoc.x) + dx,
                    y: Math.floor(startLoc.y) + dy,
                    z: Math.floor(startLoc.z) + dz
                };

                try {
                    const block = dimension.getBlock(checkLoc);
                    if (block && ORE_NAMES[block.typeId]) {
                        if (dist < minDistance) {
                            minDistance = dist;
                            nearestOre = {
                                name: ORE_NAMES[block.typeId],
                                distance: Math.round(dist * 10) / 10
                            };
                        }
                    }
                } catch (e) {
                    // アンロードされた領域はスキップ
                }
            }
        }
    }

    // 結果のフィードバック
    if (nearestOre) {
        // 検出成功
        player.sendMessage(`§a[金属探知機] §e周囲 ${nearestOre.distance} ブロック地点に ${nearestOre.name} を検出しました！`);
        // 高い音（ピコン）を再生
        try {
            dimension.playSound("random.orb", player.location, { pitch: 2.0, volume: 1.0 });
        } catch (e) { }
    } else {
        // 検出失敗
        player.sendMessage("§a[金属探知機] §7金属反応はありません。");
        // 低い音（カチッ）を再生
        try {
            dimension.playSound("random.click", player.location, { pitch: 0.5, volume: 0.8 });
        } catch (e) { }
    }
});
