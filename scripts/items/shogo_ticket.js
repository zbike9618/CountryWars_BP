import { world } from "@minecraft/server";
import { Dypro } from "../utils/dypro.js";
import { Util } from "../utils/util.js";
import { Lore } from "../utils/Lore.js";

const playerDatas = new Dypro("player");

world.afterEvents.itemUse.subscribe((event) => {
    const { source: player, itemStack: item } = event;
    if (!player || !player.isValid || item?.typeId !== "cw:shogo_ticket") return;

    const slot = player.selectedSlotIndex;

    // Loreクラスの関数（Lore.getLore）を使用して取得
    const beforeTitle = Lore.getLore(player, slot, "前") || Lore.getLore(player, slot, "before");
    const afterTitle = Lore.getLore(player, slot, "後") || Lore.getLore(player, slot, "after");

    // "称号:xxx" 形式のチェック
    const generalTitle = Lore.getLore(player, slot, "称号") || Lore.getLore(player, slot, "二つ名");
    const position = Lore.getLore(player, slot, "位置") || Lore.getLore(player, slot, "タイプ");

    const toAddBefore = [];
    const toAddAfter = [];

    if (beforeTitle) toAddBefore.push(beforeTitle);
    if (afterTitle) toAddAfter.push(afterTitle);

    if (generalTitle) {
        if (position === "後" || position?.toLowerCase() === "after") {
            toAddAfter.push(generalTitle);
        } else {
            toAddBefore.push(generalTitle);
        }
    }

    // Loreに関数で取得できる称号が見つからなかった場合
    if (toAddBefore.length === 0 && toAddAfter.length === 0) {
        player.sendMessage("§c[称号チケット] 有効な称号Loreが設定されていません。");
        player.playSound("note.bass", { volume: 0.8 });
        return;
    }

    // プレイヤーの称号データを取得・初期化
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

    const newlyAdded = [];

    // 前半の称号を追加
    for (const title of toAddBefore) {
        if (!playerData.secondname.before.includes(title)) {
            playerData.secondname.before.push(title);
            newlyAdded.push(`[前] ${title}`);
        }
    }

    // 後半の称号を追加
    for (const title of toAddAfter) {
        if (!playerData.secondname.after.includes(title)) {
            playerData.secondname.after.push(title);
            newlyAdded.push(`[後] ${title}`);
        }
    }

    // すべて既に所持していた場合
    if (newlyAdded.length === 0) {
        player.sendMessage("§e[称号チケット] すでに記載されている称号をすべて所持しています！");
        player.playSound("note.bass", { volume: 0.8 });
        return;
    }

    // チケットを1枚消費
    const inv = player.getComponent("minecraft:inventory")?.container;
    const currentItem = inv?.getItem(slot);
    if (currentItem && currentItem.typeId === "cw:shogo_ticket") {
        if (currentItem.amount > 1) {
            currentItem.amount -= 1;
            inv.setItem(slot, currentItem);
        } else {
            inv.setItem(slot, undefined);
        }
    } else {
        player.runCommand("clear @s cw:shogo_ticket 0 1");
    }

    // データを保存してネームタグ更新
    playerDatas.set(player.id, playerData);
    Util.updateNameTag(player);

    // 演出 & メッセージ
    player.playSound("random.levelup", { pitch: 1.2, volume: 1.0 });
    player.sendMessage(`§a§l[称号チケット] §r§a新しい称号を獲得しました！\n§f追加: §b${newlyAdded.join("§f, §b")}`);
});
