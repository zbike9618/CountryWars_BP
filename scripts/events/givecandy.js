import { world } from "@minecraft/server";
import { Dypro } from "../utils/dypro.js";
import { Util } from "../utils/util.js";

const playerDatas = new Dypro("player");
const TITLE_NAME = "お菓子は上げる派の";
const SCOREBOARD_OBJ_ID = "cw:give_candy";

// 対象のお菓子アイテムID一覧
const CANDY_ITEM_IDS = new Set([
    "cw:halloween_candy",
    "minecraft:cookie",
    "minecraft:pumpkin_pie",
    "minecraft:cake",
    "minecraft:honey_bottle",
    "minecraft:sweet_berries"
]);

world.afterEvents.worldLoad.subscribe(() => {
    Util.getScoreboardObjective(SCOREBOARD_OBJ_ID, "お菓子を投げた回数");
});

world.afterEvents.entityItemDrop.subscribe((ev) => {
    try {
        const player = ev.entity;
        if (!player || !player.isValid || player.typeId !== "minecraft:player") return;

        // 現在のスコアを取得
        const currentCount = Util.getScore(player, SCOREBOARD_OBJ_ID);
        if (currentCount >= 100) {
            const data = playerDatas.get(player.id);
            if (data?.secondname?.before?.includes(TITLE_NAME)) return;
        }

        // ドロップされたアイテムにお菓子が含まれているか確認
        let hasCandy = false;

        // ev.items は配列に見えるが for...of では回せない（"value is not iterable" になる）ので、添字で回す
        if (Array.isArray(ev.items)) {
            for (let i = 0; i < ev.items.length; i++) {
                const itemEntity = ev.items[i];
                try {
                    const itemComp = itemEntity.getComponent("minecraft:item");
                    const stack = itemComp?.itemStack;
                    if (stack && CANDY_ITEM_IDS.has(stack.typeId)) {
                        hasCandy = true;
                        break;
                    }
                } catch { }
            }
        }

        // API差異対応のフォールバック
        if (!hasCandy) {
            const fallbackStack = ev.itemStack || ev.item?.getComponent?.("minecraft:item")?.itemStack;
            if (fallbackStack && CANDY_ITEM_IDS.has(fallbackStack.typeId)) {
                hasCandy = true;
            }
        }

        if (!hasCandy) return;

        // スコアボードを加算
        const newCount = Util.addScore(player, SCOREBOARD_OBJ_ID, 1, "お菓子を投げた回数");

        if (newCount < 100) return;

        // 100回達成時：称号を付与・セット
        const playerData = playerDatas.get(player.id);
        if (!playerData) return;

        if (!playerData.secondname) {
            playerData.secondname = {
                before: ["一般的な"],
                after: ["鯖民"],
                now: [0, 0]
            };
        }
        if (!Array.isArray(playerData.secondname.before)) playerData.secondname.before = ["一般的な"];
        if (!Array.isArray(playerData.secondname.after)) playerData.secondname.after = ["鯖民"];
        if (!Array.isArray(playerData.secondname.now)) playerData.secondname.now = [0, 0];

        if (!playerData.secondname.before.includes(TITLE_NAME)) {
            playerData.secondname.before.push(TITLE_NAME);
            // 称号（前）をセット
            playerData.secondname.now[0] = playerData.secondname.before.length - 1;
            playerDatas.set(player.id, playerData);
            Util.updateNameTag(player);

            player.playSound("random.levelup", { pitch: 1.2, volume: 1.0 });
            player.sendMessage(`§a§l[称号獲得] §r§aお菓子を100回投げたため、称号【§b${TITLE_NAME}§a】(前) を獲得・セットしました！`);
        }
    } catch (e) {
        console.error("givecandy error:", e);
    }
});