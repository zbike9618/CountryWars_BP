import * as server from "@minecraft/server";
const { world, system } = server;
import { ModalFormData, ActionFormData } from "@minecraft/server-ui";

/** @type {Map<string, { time: number, dimension: server.Dimension, location: server.Vector3 }>} */
const bombtime = new Map();

const getCoordKey = (loc, dimId) => `${loc.x},${loc.y},${loc.z},${dimId}`;

// 1秒ごとにタイマーを減らす
system.runInterval(() => {
    for (const [key, data] of bombtime.entries()) {
        data.time--;
        if (data.time <= 0) {
            bombtime.delete(key);
            const { dimension, location } = data;
            // ブロックがまだタイマー爆弾であることを確認して爆発
            if (dimension.getBlock(location)?.typeId === "cw:timer_bomb") {
                dimension.setBlockType(location, "minecraft:air");
                dimension.createExplosion(location, 16);

            }
        }
    }
}, 20);

world.beforeEvents.playerBreakBlock.subscribe((ev) => {
    if (ev.block.typeId === "cw:timer_bomb") {
        const key = getCoordKey(ev.block.location, ev.dimension.id);
        if (bombtime.has(key)) {
            bombtime.delete(key);
            const location = ev.block.location;
            const dimension = ev.dimension;
            // 起動中に壊された場合は即座に爆発
            system.run(() => {
                dimension.setBlockType(location, "minecraft:air");
                dimension.createExplosion(location, 8);
            });
        }
    }
});

system.beforeEvents.startup.subscribe(init => {
    init.blockComponentRegistry.registerCustomComponent("cw:timer_bomb", {
        onPlayerInteract(arg) {
            const key = getCoordKey(arg.block.location, arg.dimension.id);
            if (bombtime.has(key)) {
                const remaining = bombtime.get(key).time;
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
            bombsetting(arg.player, arg.block.location, arg.dimension);
        }
    })
})

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
    bombtime.set(key, { time, dimension: dim, location });
}
