import * as server from "@minecraft/server";
const { world, system } = server;
import { Dypro } from "./dypro";
import config from "../config/config";

const playerDatas = new Dypro("player");
const countryDatas = new Dypro("country");

world.beforeEvents.chatSend.subscribe((ev) => {
    const player = ev.sender;
    const message = ev.message;
    const playerData = playerDatas.get(player.id);
    const countryname = countryDatas.get(playerData.country)?.name || "§7未所属";

    ev.cancel = true; // 標準チャットを無効化

    let chatType = "";
    switch (playerData.chattype) {
        case "world": chatType = "§aW"; break;
        case "country": chatType = "§eC"; break;
        case "local": chatType = "§cL"; break;
    }

    const secondname = playerData.secondname;
    const send = `[${chatType}§r][${secondname.before[secondname.now[0]]}§r${secondname.after[secondname.now[1]]}§r/${countryname}§r] <${player.name}> ${message}`;

    switch (playerData.chattype) {
        case "world":
            system.run(() => {
                // @a に対して tellraw を実行。これ自体が WebSocket に PlayerMessage として飛ぶ
                // 余計な [WS_RELAY] はもう不要です
                world.getDimension("overworld").runCommand(`tellraw @a {"rawtext":[{"text":"${send}"}]}`);
            });
            break;

        case "country":
            for (const pc of world.getAllPlayers().filter(p => playerDatas.get(p.id).country == playerData.country)) {
                pc.sendMessage(send);
            }
            break;

        case "local":
            for (const pc of world.getPlayers({ location: player.location, maxDistance: config.localChatDistance })) {
                pc.sendMessage(send);
            }
            break;
    }
});

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

// 通知済みプレイヤーと時間を記録するマップ
const lastSpawnNotice = new Map();

// 参加通知
world.afterEvents.playerSpawn.subscribe((ev) => {
    const { player, initialSpawn } = ev;
    if (!initialSpawn) return;

    const now = Date.now();
    const lastTime = lastSpawnNotice.get(player.id) || 0;

    // 前回の通知から3000ミリ秒（3秒）以上経っている場合のみ実行
    if (now - lastTime > 3000) {
        lastSpawnNotice.set(player.id, now); // 現在時刻を記録

        const playerName = player.name;
        system.run(() => {
            const playerCount = world.getAllPlayers().length;
            const msg = `[§aW§r] ${playerName} が参加しました (§f${playerCount}§7人)`;

            world.getDimension("overworld").runCommand(`tellraw @a {"rawtext":[{"text":"${msg}"}]}`);
        });
    }
});

// 退出通知
world.beforeEvents.playerLeave.subscribe((ev) => {
    const { player } = ev;

    // 退出時は記録を消去して、次回の参加に備える
    lastSpawnNotice.delete(player.id);

    const playerName = player.name;
    system.run(() => {
        const playerCount = world.getAllPlayers().length;
        const msg = `[§aW§r] ${playerName} が退出しました (§f${playerCount}§7人)`;

        world.getDimension("overworld").runCommand(`tellraw @a {"rawtext":[{"text":"${msg}"}]}`);
    });
});