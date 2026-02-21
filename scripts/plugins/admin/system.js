import { Dypro } from "../../utils/dypro";
import * as server from "@minecraft/server";
const { world, system } = server;
const playerDatas = new Dypro("player");
import { blacklist } from "./import.js";

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