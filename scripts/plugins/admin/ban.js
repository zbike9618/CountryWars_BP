import * as server from "@minecraft/server";
import { world } from "@minecraft/server";
import { Dypro } from "../../utils/dypro";
const playerDatas = new Dypro("player");
export class Ban {
    /**
     * 
     * @param {server.Player[]} players 
     * @param {string} reason 
     * @param {string} timeEnum 
     * @param {number} time 
     */
    static setBan(players, reason, timeEnum, time) {
        players.forEach(player => {
            const playerData = playerDatas.get(player.id);
            if (!playerData) return;

            const date = new Date();
            let finishTime;
            if (timeEnum === "day") {
                finishTime = date.getTime() + time * 24 * 60 * 60 * 1000;
            } else if (timeEnum === "hour") {
                finishTime = date.getTime() + time * 60 * 60 * 1000;
            } else if (timeEnum === "minute") {
                finishTime = date.getTime() + time * 60 * 1000;
            } else if (timeEnum === "second") {
                finishTime = date.getTime() + time * 1000;
            }
            playerData.ban = {
                reason: reason || "No reason provided",
                finishtime: finishTime
            }
            playerDatas.set(player.id, playerData);
        })
    }

    /**
     * BANを解除する
     * @param {string[]} playerIds 
     */
    static unBan(playerIds) {
        playerIds.forEach(id => {
            const playerData = playerDatas.get(id);
            if (playerData?.ban) {
                delete playerData.ban;
                playerDatas.set(id, playerData);
            }
        });
    }

    /**
     * BANされているプレイヤーのリストを取得する
     * @returns {{name: string, id: string, reason: string, finishtime: number}[]}
     */
    static getBanList() {
        const list = [];
        const ids = playerDatas.idList;
        for (const id of ids) {
            const data = playerDatas.get(id);
            if (data?.ban) {
                list.push({
                    name: data.name,
                    id: id,
                    reason: data.ban.reason,
                    finishtime: data.ban.finishtime
                });
            }
        }
        return list;
    }
}