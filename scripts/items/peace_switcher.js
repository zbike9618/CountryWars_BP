import * as server from "@minecraft/server";
const { world, system } = server;
import { Dypro } from "../utils/dypro.js";
import { DiscordRelay } from "../utils/chat.js";

const playerDatas = new Dypro("player");
const countryDatas = new Dypro("country");

world.afterEvents.itemUse.subscribe((event) => {
    const player = event.source;
    const itemStack = event.itemStack;

    if (itemStack.typeId !== "cw:peace_switcher") return;

    // プレイヤーのデータを取得
    const playerData = playerDatas.get(player.id);
    if (!playerData || !playerData.country) {
        player.sendMessage("§c[CountryWars] 国に所属していません。");
        return;
    }

    const countryId = playerData.country;
    const countryData = countryDatas.get(countryId);
    if (!countryData) {
        player.sendMessage("§c[CountryWars] 国データが見つかりません。");
        return;
    }

    // 国王（owner）であるか確認
    if (countryData.owner !== player.id) {
        player.sendMessage("§c[CountryWars] 国王のみが体制を変更できます。");
        return;
    }

    // 体制を切り替え
    countryData.isPeace = !countryData.isPeace;
    countryDatas.set(countryId, countryData);

    // アイテムを1個消費
    system.run(() => {
        const inv = player.getComponent("minecraft:inventory");
        if (!inv || !inv.container) return;
        const slot = player.selectedSlotIndex;
        const item = inv.container.getItem(slot);
        if (!item || item.typeId !== "cw:peace_switcher") return;
        if (item.amount <= 1) {
            inv.container.setItem(slot, undefined);
        } else {
            item.amount -= 1;
            inv.container.setItem(slot, item);
        }
    });

    // 通知メッセージ
    const statusText = countryData.isPeace ? "§a平和国§r" : "§c非平和国§r";
    const msg = `§a[CountryWars] §6${countryData.name}§r の体制が ${statusText} に切り替えられました！`;
    
    world.sendMessage(msg);
    try {
        DiscordRelay.send(msg); // Discordへも連携
    } catch (e) {
        console.warn(`[PeaceSwitcher] Discord relay error: ${e}`);
    }
});
