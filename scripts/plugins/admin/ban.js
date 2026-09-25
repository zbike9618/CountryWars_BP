import * as server from "@minecraft/server";
import { world } from "@minecraft/server";
import { Dypro } from "../../utils/dypro";
const playerDatas = new Dypro("player");

const TIME_UNIT_MS = {
    day: 24 * 60 * 60 * 1000,
    hour: 60 * 60 * 1000,
    minute: 60 * 1000,
    second: 1000,
};

export class Ban {
    /**
     * BAN の解除予定時刻を計算する
     * @param {string} timeEnum day / hour / minute / second
     * @param {number} time
     * @returns {number} epoch ms
     */
    static finishTimeOf(timeEnum, time) {
        const unit = TIME_UNIT_MS[timeEnum];
        if (!unit || !Number.isFinite(time) || time <= 0) {
            throw new Error(`不正なBAN期間です: ${time} ${timeEnum}`);
        }
        return Date.now() + time * unit;
    }

    /**
     * プレイヤーIDでBANする（オフラインでも可）。オンラインなら即キックする。
     * @param {string} playerId
     * @param {{ reason?: string, timeEnum: string, time: number, bannedBy?: string }} options
     * @returns {{ name: string, id: string, before: object | null } | null} プレイヤーデータが無ければ null
     */
    static banById(playerId, { reason, timeEnum, time, bannedBy }) {
        const playerData = playerDatas.get(playerId);
        if (!playerData) return null;

        const before = playerData.ban ?? null;
        playerData.ban = {
            reason: reason || "No reason provided",
            finishtime: Ban.finishTimeOf(timeEnum, time),
            bannedBy: bannedBy || "unknown",
            bannedAt: Date.now()
        };
        playerDatas.set(playerId, playerData);

        const online = world.getAllPlayers().find(p => p.id === playerId);
        if (online) Ban.kick(online, `BAN: ${playerData.ban.reason}`);

        return { name: playerData.name, id: playerId, before };
    }

    /**
     * @param {server.Player} player
     * @param {string} message
     */
    static kick(player, message) {
        const name = player.name.replace(/"/g, "");
        player.runCommand(`kick "${name}" ${message}`);
    }

    /**
     *
     * @param {server.Player | server.Player[]} players
     * @param {string} reason
     * @param {string} timeEnum
     * @param {number} time
     */
    static setBan(players, reason, timeEnum, time) {
        for (const player of [].concat(players)) {
            Ban.banById(player.id, { reason, timeEnum, time });
        }
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
     *
     * @param {server.Player} player
     * @param {string} reason
     * @param {string} timeEnum
     * @param {number} time
     */
    static doBan(player, reason, timeEnum, time) {
        Ban.banById(player.id, { reason, timeEnum, time });
    }

    /**
     * 残り時間を "1d 2h 3m" のような文字列にする
     * @param {number} ms
     */
    static formatDuration(ms) {
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

    /**
     * BANされているプレイヤーのリストを取得する（期限切れは含めない）
     * @returns {{name: string, id: string, reason: string, finishtime: number, bannedBy?: string, bannedAt?: number}[]}
     */
    static getBanList() {
        const now = Date.now();
        return Ban.getAllBanEntries().filter(b => b.finishtime > now);
    }

    /**
     * 期限切れを含む、ban を持つ全プレイヤー
     */
    static getAllBanEntries() {
        const list = [];
        for (const id of playerDatas.idList) {
            const data = playerDatas.get(id);
            if (data?.ban) {
                list.push({
                    name: data.name,
                    id: id,
                    reason: data.ban.reason,
                    finishtime: data.ban.finishtime,
                    bannedBy: data.ban.bannedBy,
                    bannedAt: data.ban.bannedAt
                });
            }
        }
        return list;
    }
}
