import { Dypro } from "../../utils/dypro";
import * as server from "@minecraft/server";
const { world, system } = server;
const playerDatas = new Dypro("player");
import { blacklist, opWhiteList, creativeWhiteList } from "./import.js";

world.afterEvents.playerSpawn.subscribe(ev => {
    if (!ev.initialSpawn) return;
    const player = ev.player;

    if (blacklist.includes(player.name)) {
        system.run(() => {
            player.runCommand(`kick "${player.name}" You are blacklisted.`);
        });
        return;
    }

    const playerData = playerDatas.get(player.id);

    if (playerData?.ban) {
        const { reason, finishtime } = playerData.ban;
        const now = new Date().getTime();

        if (finishtime > now) {
            // BAN期間中
            const remainingMs = finishtime - now;
            const remainingStr = formatTime(remainingMs);

            // 少し遅らせてキック（スポーン直後のキックが不安定な場合があるため）
            system.run(() => {
                player.runCommand(`kick "${player.name}" BAN: ${reason}\nRemaining: ${remainingStr}`);
            });
        } else {
            // BAN期限切れ
            delete playerData.ban;
            playerDatas.set(player.id, playerData);
        }
    }
});

function formatTime(ms) {
    const s = Math.floor(ms / 1000) % 60;
    const m = Math.floor(ms / (1000 * 60)) % 60;
    const h = Math.floor(ms / (1000 * 60 * 60)) % 24;
    const d = Math.floor(ms / (1000 * 60 * 60 * 24));

    let parts = [];
    if (d > 0) parts.push(`${d}d`);
    if (h > 0) parts.push(`${h}h`);
    if (m > 0) parts.push(`${m}m`);
    if (s > 0 || parts.length === 0) parts.push(`${s}s`);

    return parts.join(" ");
}
const ids = "qwertyuiopasdfghjklzxcvbnm1234567890"
function oriId() {
    let ori = "";
    const idArray = ids.split("")
    for (let i = 1; i <= 16; i++) {
        const key = Math.floor(Math.random() * idArray.length);
        ori += idArray[key];
    }
    return ori;
}
system.runInterval(() => {
    for (const player of world.getAllPlayers()) {
        if (player.hasTag("cw:op")) continue;
        if ([server.GameMode.Creative, server.GameMode.Spectator].includes(player.getGameMode())) {
            if (!creativeWhiteList.includes(player.name)) {
                player.setGameMode(server.GameMode.Survival);
                player.runCommand("kick @s 不正なゲームモードの変更");
            }
        }
        if (player.commandPermissionLevel === server.CommandPermissionLevel.Admin) {
            if (!opWhiteList.includes(player.name)) {
                player.runCommand("kick @s 不正な権限");
            }
        }
    }
}, 20);

system.runInterval(() => {
    for (const player of world.getAllPlayers()) {
        const comp = player.getComponent("inventory");
        const inv = comp.container;
        const has = []
        for (let i = 0; i < inv.size; i++) {
            const item = inv.getItem(i);
            if (item) {
                let key = item.getDynamicProperty("cw:id");
                world.sendMessage(`${key}`)
                if (key === undefined) {
                    key = oriId();
                    item.setDynamicProperty("cw:id", key);
                    inv.setItem(i, item); // 更新したアイテムを保存する必要があります
                }

                if (has.includes(key)) {
                    //player.runCommand("kick @s 不正なアイテムの増殖");
                    inv.setItem(i, undefined);
                    continue;
                }
                has.push(key);
            }
        }
    }
})