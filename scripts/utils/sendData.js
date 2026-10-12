import { world, system } from "@minecraft/server";
import { ShortPlayerData } from "./playerData.js";
import { Util } from "./util.js";
import { Dypro } from "./dypro.js";

const sendDataDypro = new Dypro("sendDataQueue");
/**
 * サーバーにいたプレイヤーに権限を渡す
 * @param {string} dataM 実行したいコード
 * @param {string} playerId 
 */
export function sendDataForPlayers(dataM, playerId) {
    // dataMが有効な文字列かチェック
    if (typeof dataM !== "string" || !dataM || dataM === "undefined") {
        return;
    }

    // オンラインプレイヤーを確実に取得
    const player = world.getAllPlayers().find(p => p.id === playerId);
    if (player) {
        try {
            eval(dataM);
        } catch (e) {
            console.warn(`[sendDataForPlayers] Eval error for online player ${playerId}: ${e}`);
        }
        return;
    }

    // オフラインの場合はプレイヤー個別のキューに保存（Dyproを使用することで32KB制限を回避）
    let queue = sendDataDypro.get(playerId) || [];
    queue.push({ dataM, time: world.getAbsoluteTime() });
    sendDataDypro.set(playerId, queue);
}

world.afterEvents.playerSpawn.subscribe((ev) => {
    if (ev.initialSpawn) {
        const player = ev.player;
        // 参加したプレイヤー専用のキューのみを1tick後に処理
        system.runTimeout(() => {
            const queue = sendDataDypro.get(player.id);
            if (!queue || queue.length === 0) return;

            for (const entry of queue) {
                // 48時間以上経過したデータはスキップ（オプション）
                const nowTime = world.getAbsoluteTime();
                if (convertTicks(nowTime).hours - convertTicks(entry.time).hours > 48) {
                    continue;
                }

                if (typeof entry.dataM === "string" && entry.dataM && entry.dataM !== "undefined") {
                    try {
                        eval(entry.dataM);
                    } catch (e) {
                        console.warn(`[sendDataForPlayers] Eval error for joining player ${player.name}: ${e}`);
                    }
                }
            }
            // 処理が終わったらそのプレイヤーのキューを削除
            sendDataDypro.delete(player.id);
        }, 20); // 20ticks(1s) 待ってから実行（ロード完了を確実にするため）
    }
});

/**
 * Minecraft の tick を 秒・分・時に変換する関数
 * @param {number} ticks - tick数
 * @returns {{hours:number, minutes:number, seconds:number}}
 */
function convertTicks(ticks) {
    const totalSeconds = Math.floor(ticks / 20); // tick → 秒
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return { hours, minutes, seconds };
}