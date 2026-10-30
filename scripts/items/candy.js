import { world } from "@minecraft/server";
import { Dypro } from "../utils/dypro.js";
import { Util } from "../utils/util.js";

const playerDatas = new Dypro("player");
const TITLE_NAME = "キャンディ好き";
const SCOREBOARD_OBJ_ID = "cw:eat_candy";
const TARGET_ITEM_ID = "cw:candy";

world.afterEvents.worldLoad.subscribe(() => {
    Util.getScoreboardObjective(SCOREBOARD_OBJ_ID, "キャンディを食べた回数");
});

world.afterEvents.itemCompleteUse.subscribe((ev) => {
    try {
        const player = ev.source;
        if (!player || !player.isValid || player.typeId !== "minecraft:player") return;

        const itemStack = ev.itemStack;
        if (!itemStack || itemStack.typeId !== TARGET_ITEM_ID) return;

        // 効果: 通常のHP回復（ハート2個分 = 4HP回復）
        Util.heal(player, 4);

        // 現在の食べた回数を取得
        const currentCount = Util.getScore(player, SCOREBOARD_OBJ_ID);
        if (currentCount >= 50) {
            const data = playerDatas.get(player.id);
            if (data?.secondname?.after?.includes(TITLE_NAME)) return;
        }

        // スコアボードを加算
        const newCount = Util.addScore(player, SCOREBOARD_OBJ_ID, 1, "キャンディを食べた回数");

        // 50個未満ならそのまま終了
        if (newCount < 50) return;

        // 50個達成時: 称号「キャンディ好き」を付与・セット
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

        let added = false;
        if (!playerData.secondname.after.includes(TITLE_NAME)) {
            playerData.secondname.after.push(TITLE_NAME);
            // 称号（後）にセット
            playerData.secondname.now[1] = playerData.secondname.after.length - 1;
            added = true;
        }
        if (!playerData.secondname.before.includes(TITLE_NAME)) {
            playerData.secondname.before.push(TITLE_NAME);
            added = true;
        }

        if (added) {
            playerDatas.set(player.id, playerData);
            Util.updateNameTag(player);

            player.playSound("random.levelup", { pitch: 1.2, volume: 1.0 });
            player.sendMessage(`§a§l[称号獲得] §r§aキャンディを50個食べたため、称号【§b${TITLE_NAME}§a】を獲得・セットしました！`);
        }
    } catch (e) {
        console.error("candy eat error:", e);
    }
});
