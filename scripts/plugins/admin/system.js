import { Dypro } from "../../utils/dypro";
import { DiscordRelay } from "../../utils/chat.js";
import * as server from "@minecraft/server";
const { world, system } = server;
const playerDatas = new Dypro("player");
import { blacklist, opWhiteList } from "./import.js";
import { Ban } from "./ban.js";

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
            const remainingStr = Ban.formatDuration(remainingMs);

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

system.runInterval(() => {
    for (const player of world.getAllPlayers()) {
        // ゲームモードのチェック
        if ([server.GameMode.Creative, server.GameMode.Spectator].includes(player.getGameMode())) {
            // cw:creative_allowed タグがないプレイヤーはサバイバルに戻す
            if (!player.hasTag("cw:creative_allowed")) {
                player.setGameMode(server.GameMode.Survival);
            }
        }
        // OP権限の不正監視
        if (player.commandPermissionLevel === server.CommandPermissionLevel.Admin) {
            if (!opWhiteList.includes(player.name)) {
                // banById がオンラインのプレイヤーをキックする
                Ban.banById(player.id, { reason: "不正な権限", timeEnum: "day", time: 365, bannedBy: "system" });
                world.sendMessage("kick")

            }
        }
    }
}, 20);
