import { world, system } from "@minecraft/server";
import { ShortPlayerData } from "./playerData.js";

/**
 * サーバーにいたプレイヤーに権限を渡す
 * @param {*} dataM 実行したいコード
 * @param {*} playerId 
 */
export function sendDataForPlayers(dataM, playerId) {
    // dataMがundefined, null, 空文字, "undefined"文字列なら何もしない
    if (typeof dataM !== "string" || !dataM || dataM === "undefined") {
        world.sendMessage(`[sendDataForPlayers] 無効なdataM: ${String(dataM)}`);
        return;
    }
    if (world.getEntity(playerId)) {
        eval(dataM);
        return;
    }
    let data = JSON.parse(world.getDynamicProperty("sendDataForPlayer") ?? "[]");
    const time = world.getAbsoluteTime();
    // JSONで保存
    data.push(JSON.stringify({ playerId, dataM, time }));
    world.setDynamicProperty("sendDataForPlayer", JSON.stringify(data));
}

world.afterEvents.playerSpawn.subscribe((ev) => {
    if (ev.initialSpawn) {
        const player = ev.player;
        system.runTimeout(() => {
            let data = JSON.parse(world.getDynamicProperty("sendDataForPlayer") ?? "[]");
            let newData = [];
            for (const d of data) {
                let entry;
                try {
                    entry = JSON.parse(d);
                } catch {
                    continue;
                }
                // entry.dataMがundefined, null, 空文字, "undefined"文字列ならevalしない
                if (entry.playerId === player.id) {
                    if (typeof entry.dataM === "string" && entry.dataM && entry.dataM !== "undefined") {
                        try {
                            eval(entry.dataM); // セキュリティ注意
                        }
                        catch (e) {
                            //そのやつを消す
                            continue;
                        }
                    } else {
                        world.sendMessage(`[sendDataForPlayers] 無効なentry.dataM: ${String(entry.dataM)}`);
                    }
                } else {
                    // 48時間以内のデータは残す
                    const nowtime = world.getAbsoluteTime();
                    if (convertTicks(nowtime).hours - convertTicks(entry.time).hours <= 48) {
                        newData.push(d);
                    }
                }
            }
            world.setDynamicProperty("sendDataForPlayer", JSON.stringify(newData));

        }, 20);
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