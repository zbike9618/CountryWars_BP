import * as server from "@minecraft/server"
const { world, system } = server;
import { ModalFormData } from "@minecraft/server-ui";
import { blockInteractCallbacks, redstoneUpdateCallbacks } from "../utils/resister.js";
class DyproRS {
    constructor(id) {
        this.id = id
    }

    set(value) {
        world.setDynamicProperty(this.id, JSON.stringify(value))
    }
    get() {
        const data = world.getDynamicProperty(this.id)
        if (data === undefined) return {}
        return JSON.parse(data)
    }
    delete() {
        world.setDynamicProperty(this.id)
    }
}

const cData = new DyproRS("connector")
const aData = new DyproRS("antenna")
blockInteractCallbacks.push((arg) => {
    /** @type {import("@minecraft/server").BlockComponentPlayerInteractEvent} */
    const e = arg;
    const player = e.player
    switch (e.block.typeId) {
        case "cw:redstone_connector":
            connectorSetting(player, e.block.location)
            break;
        case "cw:redstone_antenna":
            antennaSetting(player, e.block.location)
            break;
    }
});
redstoneUpdateCallbacks.push((arg) => {
    /** @type {import("@minecraft/server").BlockComponentRedstoneUpdateEvent} */
    const e = arg;
    switch (e.block.typeId) {
        case "cw:redstone_connector":
            connectorUpdate(e)
            break;
    }
});

// ブロック破壊時のクリーンアップ
world.afterEvents.playerBreakBlock.subscribe((ev) => {
    const { block, dimension, brokenBlockPermutation } = ev;
    const loc = block.location;
    const coordKey = getCoordKey(loc);

    if (brokenBlockPermutation.type.id === "cw:redstone_connector") {
        const cnData = cData.get();
        const channelKey = cnData[coordKey];
        if (channelKey) {
            // 関連するアンテナの信号をリセット
            const anData = aData.get();
            const locs = anData[channelKey];
            if (locs) {
                for (const aLoc of locs) {
                    const aBlock = dimension.getBlock(aLoc);
                    if (aBlock && aBlock.typeId === "cw:redstone_antenna") {
                        aBlock.setPermutation(aBlock.permutation.withState("cw:redstone_signal", 0));
                    }
                }
            }
            // データを削除
            delete cnData[coordKey];
            cData.set(cnData);
        }
    } else if (brokenBlockPermutation.type.id === "cw:redstone_antenna") {
        const data = aData.get();
        let changed = false;
        for (const k of Object.keys(data)) {
            const initialLength = data[k].length;
            data[k] = data[k].filter(l => !(l.x === loc.x && l.y === loc.y && l.z === loc.z));
            if (data[k].length !== initialLength) {
                changed = true;
                if (data[k].length === 0) delete data[k];
            }
        }
        if (changed) aData.set(data);
    }
});
/**
 * 
 * @param {import("@minecraft/server").BlockComponentRedstoneUpdateEvent} e 
 */
const getCoordKey = (loc) => `${loc.x},${loc.y},${loc.z}`;

// 変更: キーを座標、値をチャンネルIDにする
// connector: { "x,y,z": "channelKey" }
// antenna: { "channelKey": [ {x,y,z}, ... ] }

/**
 * 
 * @param {import("@minecraft/server").BlockComponentRedstoneUpdateEvent} e 
 */
function connectorUpdate(e) {
    const cnData = cData.get();
    const key = getCoordKey(e.block.location);
    const redstonekey = cnData[key];

    // world.sendMessage(`${redstonekey}`); 
    if (!redstonekey) return;

    const anData = aData.get();
    const locs = anData[redstonekey];
    if (!locs) return;

    const dimension = e.dimension; // イベントからディメンションを取得

    for (const loc of locs) {
        // 同じディメンションにあると仮定、もしくは保存データにディメンションを含める必要があるが
        // 現状のコードに合わせて位置情報のみを使用
        try {
            const block = dimension.getBlock(loc);
            if (!block) continue;
            const per = block.permutation;
            if (block.typeId === "cw:redstone_antenna") {
                block.setPermutation(per.withState("cw:redstone_signal", e.powerLevel));
            } else {
                anData[redstonekey].splice(anData[redstonekey].indexOf(loc), 1);
                aData.set(anData);
            }
        } catch (e) {

        }
    }
}

/**
 * 
 * @param {server.Player} player 
 */
async function antennaSetting(player, loc) {
    const data = aData.get();
    let defaultKey = "";

    // 現在登録されているチャンネルを探す
    for (const [key, locs] of Object.entries(data)) {
        if (locs.some(l => l.x === loc.x && l.y === loc.y && l.z === loc.z)) {
            defaultKey = key;
            break;
        }
    }

    const form = new ModalFormData()
    form.title({ translate: "cw.redstone.antenna.title" })
    form.textField({ translate: "cw.redstone.antenna.key" }, "Press Key", { defaultValue: defaultKey })
    const res = await form.show(player)
    if (res.canceled) return;

    const key = res.formValues[0];

    // 全てのチャンネルからこの座標を一度削除する (チャンネル変更に対応)
    for (const k of Object.keys(data)) {
        data[k] = data[k].filter(l => !(l.x === loc.x && l.y === loc.y && l.z === loc.z));
        // メンバーがいなくなったチャンネルは削除
        if (data[k].length === 0) delete data[k];
    }

    // 新しいチャンネルに追加
    if (data[key]) {
        data[key].push(loc);
    } else {
        data[key] = [loc];
    }

    aData.set(data);

    // 信号をリセット
    const block = player.dimension.getBlock(loc);
    if (block && block.typeId === "cw:redstone_antenna") {
        block.setPermutation(block.permutation.withState("cw:redstone_signal", 0));
    }

    player.sendMessage(`Antenna updated: Channel "${key}"`);
}

/**
 * 
 * @param {server.Player} player 
 * @param {server.Vector3} loc
 */
async function connectorSetting(player, loc) {
    const olddata = cData.get();
    const coordKey = getCoordKey(loc);
    const defaultKey = olddata[coordKey] || "";

    const form = new ModalFormData()
    form.title({ translate: "cw.redstone.connector.title" })
    form.textField({ translate: "cw.redstone.connector.key" }, "Press Key", { defaultValue: defaultKey })
    const res = await form.show(player)
    if (res.canceled) return;

    const key = res.formValues[0];

    // チャンネルが変更された場合、古いチャンネルのアンテナ信号をリセットする
    if (defaultKey && defaultKey !== key) {
        const anData = aData.get();
        const locs = anData[defaultKey];
        if (locs) {
            for (const aLoc of locs) {
                const block = player.dimension.getBlock(aLoc);
                if (block && block.typeId === "cw:redstone_antenna") {
                    block.setPermutation(block.permutation.withState("cw:redstone_signal", 0));
                }
            }
        }
    }

    // 座標をキーにしてチャンネルIDを保存
    olddata[coordKey] = key;

    cData.set(olddata);
    player.sendMessage(`Connector registered to channel: ${key}`);
}