import * as server from "@minecraft/server";
const { world, system } = server;
import { DiscordRelay, sendChatToDiscord, sendToDiscord } from "./discord.js";
export { DiscordRelay, sendChatToDiscord, sendToDiscord };
import { Dypro } from "./dypro.js";
import config from "../config/config.js";

const playerDatas = new Dypro("player");
const countryDatas = new Dypro("country");

/**
 * 死亡ログ処理
 */
world.afterEvents.entityDie.subscribe((ev) => {
    const { deadEntity, damageSource } = ev;
    if (deadEntity.typeId !== "minecraft:player") return;

    const victim = deadEntity.name;
    const attacker = damageSource.damagingEntity?.name;
    let msg = "";

    if (attacker) {
        msg = `[§cDeath§r] ${victim} は ${attacker} に倒されました`;
    } else {
        msg = `[§cDeath§r] ${victim} が死亡しました`;
    }

    DiscordRelay.send(msg);
});

/**
 * チャット処理
 */
world.beforeEvents.chatSend.subscribe((ev) => {
    const player = ev.sender;
    const message = ev.message;
    const playerData = playerDatas.get(player.id);
    // --- 国に加入していないのに国・同盟チャットになっている場合の修正 ---
    if ((playerData.chattype === "country" || playerData.chattype === "ally") && (!playerData.country || !countryDatas.get(playerData.country))) {
        playerData.chattype = "world";
        playerDatas.set(player.id, playerData);
    }

    const countryname = countryDatas.get(playerData.country)?.name || "§7未所属";


    // --- AI質問の検知 ---
    if (message.startsWith("!ai ")) {
        sendChatToDiscord(message, player.name);
        ev.cancel = true;
        world.sendMessage(`[!ai] <${player.name}> ${message}`);
        return;
    }

    ev.cancel = true;

    let chatTypeSymbol = "";
    switch (playerData.chattype) {
        case "world": chatTypeSymbol = "§aW"; break;
        case "country": chatTypeSymbol = "§eC"; break;
        case "local": chatTypeSymbol = "§cL"; break;
        case "ally": chatTypeSymbol = "§dA"; break;
    }


    const secondname = playerData.secondname;
    const send = `[${chatTypeSymbol}§r][${secondname.before[secondname.now[0]]}§r${secondname.after[secondname.now[1]]}§r/${countryname}§r] <${player.name}> ${message}`;

    switch (playerData.chattype) {
        case "world":
            world.sendMessage(send);
            if (!message.startsWith("!ai ")) sendChatToDiscord(send, player.name, "world");
            break;
        case "country":
            for (const pc of world.getAllPlayers().filter(p => playerDatas.get(p.id).country == playerData.country)) {
                pc.sendMessage(send);
            }
            sendChatToDiscord(send, player.name, "country");
            break;
        case "local":
            for (const pc of player.dimension.getPlayers({ location: player.location, maxDistance: config.localChatDistance })) {
                pc.sendMessage(send);
            }
            sendChatToDiscord(send, player.name, "local");
            break;
        case "ally": { // ← 追加
            const myCountryData = countryDatas.get(playerData.country);
            if (!myCountryData) {
                player.sendMessage("§c国に所属していないため同盟チャットは使用できません。");
                break;
            }
            const allyIds = myCountryData.diplomacy?.ally ?? [];
            const allowedCountries = new Set([playerData.country, ...allyIds]);
            for (const pc of world.getAllPlayers().filter(p => allowedCountries.has(playerDatas.get(p.id).country))) {
                pc.sendMessage(send);
            }
            break;
        }
    }

}
);

/**
 * その他（参加退出・タイプ変更）
 */
export function ChangeChatType(player, type) {
    const playerData = playerDatas.get(player.id);
    if (playerData.chattype == type) {
        player.sendMessage({ translate: "cw.chattype.already", with: [type] });
        player.playSound("note.bass");
        return;
    }
    playerData.chattype = type;
    playerDatas.set(player.id, playerData);
    player.sendMessage({ translate: "cw.chattype.changed", with: [type] });
    player.playSound("random.orb");
}

const lastSpawnNotice = new Map();

world.afterEvents.playerSpawn.subscribe((ev) => {
    const { player, initialSpawn } = ev;
    if (!initialSpawn) return;
    const now = Date.now();
    const lastTime = lastSpawnNotice.get(player.id) || 0;
    if (now - lastTime > 3000) {
        lastSpawnNotice.set(player.id, now);
        const playerCount = world.getAllPlayers().length;
        const msg = `[§aW§r] ${player.name} が参加しました (§f${playerCount}§7人)`;
        world.sendMessage(msg);
        sendToDiscord(msg);
    }
});

world.beforeEvents.playerLeave.subscribe((ev) => {
    const { player } = ev;
    lastSpawnNotice.delete(player.id);
    const playerCount = world.getAllPlayers().length - 1;
    const msg = `[§aW§r] ${player.name} が退出しました (§f${playerCount}§7人)`;
    world.sendMessage(msg);
    sendToDiscord(msg);
});