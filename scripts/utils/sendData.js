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
                if (isExpiredQueueEntry(entry, world.getAbsoluteTime())) {
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
 * 参加時に実行されない（ゲーム内で48時間より古い）キューのデータか
 * @param {{time: number}} entry
 * @param {number} nowTime world.getAbsoluteTime()
 */
export function isExpiredQueueEntry(entry, nowTime) {
    return convertTicks(nowTime).hours - convertTicks(entry.time).hours > 48;
}

/**
 * 旧方式の全体アナウンスのうち、もう実行されない期限切れのものをキューから消す。
 * 旧方式ではアナウンスのたびにオフラインの全員のキューへ積んでいて、
 * 2026-10 時点でワールドの dynamic property 約6.7MBのうち約5.4MBを占めていた。
 * 期限切れの分しか消さないので、プレイヤーから見える動作は変わらない。
 */
function* removeExpiredLegacyAnnouncements() {
    const nowTime = world.getAbsoluteTime();
    let removed = 0;
    let emptied = 0;
    for (const playerId of sendDataDypro.idList) {
        const queue = sendDataDypro.get(playerId);
        if (Array.isArray(queue)) {
            const kept = queue.filter(entry =>
                !(typeof entry?.dataM === "string" && entry.dataM.includes("[全体アナウンス]") && isExpiredQueueEntry(entry, nowTime))
            );
            if (kept.length < queue.length) {
                removed += queue.length - kept.length;
                if (kept.length === 0) {
                    sendDataDypro.delete(playerId);
                    emptied++;
                } else {
                    sendDataDypro.set(playerId, kept);
                }
            }
        }
        yield;
    }
    if (removed > 0) {
        console.warn(`[sendData] 期限切れの旧アナウンス ${removed} 件をキューから削除しました（空になったキュー ${emptied} 件）`);
    }
}

world.afterEvents.worldLoad.subscribe(() => {
    system.runJob(removeExpiredLegacyAnnouncements());
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