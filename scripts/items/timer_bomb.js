import * as server from "@minecraft/server";
const { world, system } = server;
import { ModalFormData } from "@minecraft/server-ui";
import { Dypro } from "../utils/dypro.js";

// Dyproのインスタンスを生成（永続化用）
const bombDypro = new Dypro("cw_timer_bomb");

// 座標とディメンションIDから安全なDynamic Propertyキーを生成
const getCoordKey = (loc, dimId) => {
    const safeDimId = dimId.replace(":", "_");
    return `${loc.x}_${loc.y}_${loc.z}_${safeDimId}`;
};

// 1秒ごとにタイマーを減らす
system.runInterval(() => {
    for (const key of bombDypro.idList) {
        const data = bombDypro.get(key);
        if (!data) continue;

        const { location, dimensionId } = data;
        const dimension = world.getDimension(dimensionId);

        try {
            // ブロックが読み込まれていない、またはタイマー爆弾でない場合は処理を中断して削除
            const block = dimension.getBlock(location);
            if (!block || block.typeId !== "cw:timer_bomb") {
                bombDypro.delete(key);
                continue;
            }

            data.time--;

            if (data.time <= 0) {
                bombDypro.delete(key);
                dimension.setBlockType(location, "minecraft:air");
                dimension.createExplosion(location, 8);
            } else {
                // デクリメントしたデータを永続化保存
                bombDypro.set(key, data);

                // 音を鳴らす処理
                if (data.time <= 5) {
                    // 残り5秒以下の場合は高いピッチの警告音
                    dimension.playSound("random.orb", location, { pitch: 1.5, volume: 1.0 });
                } else {
                    // 通常時はカチッという音
                    dimension.playSound("random.click", location, { pitch: 1.0, volume: 0.8 });
                }
            }
        } catch (e) {
            // チャンク未ロードなど一時的なエラーの場合はスキップ
            console.warn(`[TimerBomb] Error processing timer: ${e}`);
        }
    }
}, 20);

world.beforeEvents.playerBreakBlock.subscribe((ev) => {
    if (ev.block.typeId === "cw:timer_bomb") {
        const key = getCoordKey(ev.block.location, ev.dimension.id);
        const data = bombDypro.get(key);
        if (data) {
            bombDypro.delete(key);
            const location = ev.block.location;
            const dimension = ev.dimension;
            // 起動中に壊された場合は即座に爆発
            system.run(() => {
                dimension.setBlockType(location, "minecraft:air");
                dimension.createExplosion(location, 6);
            });
        }
    }
});

import { blockInteractCallbacks } from "../utils/resister.js";
blockInteractCallbacks.push((arg) => {
    if (arg.block.typeId != "cw:timer_bomb") return;
    const key = getCoordKey(arg.block.location, arg.dimension.id);
    const data = bombDypro.get(key);
    if (data) {
        const remaining = data.time;
        let hour = Math.floor(remaining / 3600).toString();
        if (hour.length == 1) hour = `0${hour}`;
        let minute = Math.floor((remaining % 3600) / 60).toString();
        if (minute.length == 1) minute = `0${minute}`;
        let second = Math.floor(remaining % 60).toString();
        if (second.length == 1) second = `0${second}`
        arg.player.onScreenDisplay.setActionBar({
            translate: "cw.timer_bomb.check",
            with: [hour, minute, second]
        });
        return;
    }
    
    // UIフォームの表示が同期イベントで拒否されないように次のティックへ遅延
    system.run(() => {
        bombsetting(arg.player, arg.block.location, arg.dimension);
    });
});

/**
 * @param {server.Player} player 
 * @param {server.Vector3} location 
 * @param {server.Dimension} dim 
 */
async function bombsetting(player, location, dim) {
    const form = new ModalFormData();
    form.title({ translate: "cw.timer_bomb.title" });
    form.textField({ translate: "cw.timer_bomb.time" }, "Press Number", { tooltip: { translate: "cw.timer_bomb.tooltip" } });

    const res = await form.show(player);
    if (res.canceled) return;

    const time = Number(res.formValues[0]);
    if (isNaN(time) || time < 0) {
        player.sendMessage({ translate: "cw.timer_bomb.warn" });
        return;
    }

    const key = getCoordKey(location, dim.id);
    bombDypro.set(key, { time, dimensionId: dim.id, location });
}
