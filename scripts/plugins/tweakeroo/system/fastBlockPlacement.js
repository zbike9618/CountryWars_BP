import * as server from "@minecraft/server"
const { world, system } = server;
import { JsonDypro } from "../util/jsonDypro.js";
import { changeMainItem } from "../util/changeInventoryItem.js";
import { Util } from "../../../utils/util.js";
import { TwUtil } from "../util/util.js";
const settingData = new JsonDypro("tweakeroo_setting")

world.afterEvents.itemUse.subscribe((ev) => {
    const player = ev.source;
    const item = ev.itemStack
    if (!settingData.get(player)?.fastBlockPlacement) return;
    if (!item.localizationKey.includes("tile")) return;
    const dir = player.getRotation()
    if (Math.floor(dir.x) > -70) return;
    const block = player.getBlockFromViewDirection({ maxDistance: 6 })
    if (block?.block) return;
    const type = settingData.get(player)?.fastBlockPlacementType || 0;
    settingData.set(player, "fastBlockPlacementType", type + 1 > 6 ? 0 : type + 1)
    player.onScreenDisplay.setActionBar(`PlaceMode: ${fastblockTypes[settingData.get(player)?.fastBlockPlacementType]}`)
})
const fastblockTypes = {
    0: "none",
    1: "plane",
    2: "face",
    3: "column",
    4: "line",
    5: "diagonal[§5WIP§r]",
    6: "layer"
}
//----------------------System----------------------
const modeswitch = new Map()
const planeConstraint = new Map()
world.afterEvents.playerPlaceBlock.subscribe((ev) => {
    const player = ev.player;
    if (!settingData.get(player)?.fastBlockPlacement) return;
    const type = settingData.get(player)?.fastBlockPlacementType;
    if (type == 2) {
        const rot = player.getRotation();
        if (rot.x < 70) return;
    }

    const currentMode = modeswitch.get(player.id);
    if (currentMode > 0) {
        // すでにセッションが開始されている場合
        if (currentMode === 6) {
            let history = planeConstraint.get(player.id) || [];
            if (history.length === 3) {
                const [ox, oy, oz] = history;
                const pLoc = player.location;

                // 自分の今の位置(px, pz)をブラシの固定位置（アンカー）にする
                const fx = Math.floor(pLoc.x);
                const fz = Math.floor(pLoc.z);

                const ddx = ox - fx;
                const ddz = oz - fz;
                const steps = Math.max(Math.abs(ddx), Math.abs(ddz));
                const offsets = [];
                for (let i = 0; i <= steps; i++) {
                    const t = steps === 0 ? 0 : i / steps;
                    offsets.push({
                        dx: Math.floor(ddx * t),
                        dz: Math.floor(ddz * t)
                    });
                }

                if (offsets.length > 0) {
                    // [offsets, fixedY, 1] - 3つ目はフラグ
                    planeConstraint.set(player.id, [offsets, oy, 1]);
                    return;
                }
            }
        }
        return;
    }

    modeswitch.set(player.id, type)
    if (type === 6) {
        const bl = ev.block.location;
        const pLoc = player.location;
        // X, Z座標はプレイヤーの現在位置を基準にすることで、遠目クリックによるブラシのズレを解消
        planeConstraint.set(player.id, [Math.floor(pLoc.x), bl.y, Math.floor(pLoc.z)]);
    } else {
        planeConstraint.set(player.id, [])
    }
})

system.runInterval(() => {
    for (const player of world.getPlayers()) {
        if (!settingData.get(player)?.fastBlockPlacement) continue;
        const mode = modeswitch.get(player.id);
        if (!mode) continue;

        const block = player.getBlockFromViewDirection({ maxDistance: 6 });
        if (mode !== 6 && !block?.block) continue;

        const comp = player.getComponent("minecraft:inventory").container;
        const item = comp.getItem(player.selectedSlotIndex);
        if (!item) continue;

        const loc = block?.block?.location;
        const dim = block?.block?.dimension;
        if (mode === 1) {
            const face = block.faceLocation;
            const dirs = [
                [0, 1, 0, face.y > 0.7 && face.y != 1, "y"],
                [0, -1, 0, face.y < 0.3 && face.y != 0, "y"],
                [1, 0, 0, face.x > 0.8 && face.x != 1, "x"],
                [-1, 0, 0, face.x < 0.2 && face.x != 0, "x"],
                [0, 0, 1, face.z > 0.8 && face.z != 1, "z"],
                [0, 0, -1, face.z < 0.2 && face.z != 0, "z"]
            ];
            let history = planeConstraint.get(player.id) || [];
            const distinctAxes = new Set(history);

            dirs.forEach(([dx, dy, dz, cond, axis]) => {
                if (!cond) return;
                if (distinctAxes.size >= 2) {
                    if (distinctAxes.has('x') && distinctAxes.has('z') && axis === 'y') return;
                    if (distinctAxes.has('x') && distinctAxes.has('y') && axis === 'z') return;
                    if (distinctAxes.has('z') && distinctAxes.has('y') && axis === 'x') return;
                }

                if (TwUtil.placeBlock(player, { x: loc.x + dx, y: loc.y + dy, z: loc.z + dz })) {
                    if (distinctAxes.size < 2) {
                        history.push(axis);
                        planeConstraint.set(player.id, history);
                    }
                }
            });
        }
        if (mode === 3) {
            const face = block.faceLocation;
            const dirs = [
                [0, 1, 0, face.y > 0.6, "y"],
                [0, -1, 0, face.y < 0.4, "y"],
                [1, 0, 0, face.x > 0.6 && face.x != 1, "x"],
                [-1, 0, 0, face.x < 0.4 && face.x != 0, "x"],
                [0, 0, 1, face.z > 0.6 && face.z != 1, "z"],
                [0, 0, -1, face.z < 0.4 && face.z != 0, "z"]
            ];
            let history = planeConstraint.get(player.id) || [];
            const activeAxis = history[0];

            for (const [dx, dy, dz, cond, axis] of dirs) {
                if (!cond) continue;
                // すでに軸が決まっている場合はその軸以外をスキップ
                if (activeAxis && axis !== activeAxis) continue;

                if (TwUtil.placeBlock(player, { x: loc.x + dx, y: loc.y + dy, z: loc.z + dz })) {
                    if (!activeAxis) {
                        planeConstraint.set(player.id, [axis]);
                    }
                    break; // 1回で1方向のみ
                }
            }
        }
        if (mode === 4) {
            let history = planeConstraint.get(player.id) || [];

            if (history.length === 3) {
                // 保存された方向 [dx, dz] と固定された高さ [targetY] を使用
                const [hdx, hdz, hTargetY] = history;
                TwUtil.placeBlock(player, { x: loc.x + hdx, y: hTargetY, z: loc.z + hdz });
            } else {
                const view = player.getViewDirection();
                let dx = 0, dz = 0;
                if (Math.abs(view.x) > Math.abs(view.z)) {
                    dx = view.x > 0 ? 1 : -1;
                } else {
                    dz = view.z > 0 ? 1 : -1;
                }

                const targetY = loc.y; // 最初の設置高さを記録
                if (TwUtil.placeBlock(player, { x: loc.x + dx, y: targetY, z: loc.z + dz })) {
                    planeConstraint.set(player.id, [dx, dz, targetY]);
                }
            }
        }
        if (mode === 5 && loc) {
            let history = planeConstraint.get(player.id) || [];
            if (history.length === 8) {
                const [hdx, hdy, hdz, ha1, ha2, hPA, hTC, hSP] = history;

                // 叩いているのが土台か、すでに設置したブロックかを判定
                const offset = hdx + hdy + hdz;
                const isBase = loc[hPA] === hTC;
                const isPlaced = loc[hPA] === hTC + offset;

                if (!isBase && !isPlaced) continue;

                // 土台を基準にした平面座標を取得
                const fLoc = {
                    x: isPlaced ? loc.x - hdx : loc.x,
                    y: isPlaced ? loc.y - hdy : loc.y,
                    z: isPlaced ? loc.z - hdz : loc.z
                };

                const p1 = (Math.floor(fLoc[ha1]) % 2 + 2) % 2;
                const p2 = (Math.floor(fLoc[ha2]) % 2 + 2) % 2;
                if ((p1 + p2) % 2 === hSP) {
                    TwUtil.placeBlock(player, { x: fLoc.x + hdx, y: fLoc.y + hdy, z: fLoc.z + hdz });
                }
            } else {
                const hitFace = block.face;
                const faceToKey = { 0: "Down", 1: "Up", 2: "North", 3: "South", 4: "West", 5: "East", "Down": "Down", "Up": "Up", "North": "North", "South": "South", "West": "West", "East": "East" };
                const config = {
                    "Up": [0, 1, 0, "x", "z", "y"], "Down": [0, -1, 0, "x", "z", "y"],
                    "North": [0, 0, -1, "x", "y", "z"], "South": [0, 0, 1, "x", "y", "z"],
                    "West": [-1, 0, 0, "y", "z", "x"], "East": [1, 0, 0, "y", "z", "x"]
                }[faceToKey[hitFace]];

                if (config) {
                    const [dx, dy, dz, a1, a2, pAxis] = config;
                    if (TwUtil.placeBlock(player, { x: loc.x + dx, y: loc.y + dy, z: loc.z + dz })) {
                        const p1 = (Math.floor(loc[a1]) % 2 + 2) % 2;
                        const p2 = (Math.floor(loc[a2]) % 2 + 2) % 2;
                        planeConstraint.set(player.id, [dx, dy, dz, a1, a2, pAxis, loc[pAxis], (p1 + p2) % 2]);
                    }
                }
            }
        }
        if (mode === 2 && loc) {
            const rot = player.getRotation()
            if (rot.x < 70) {
                modeswitch.set(player.id, 0)
                planeConstraint.set(player.id, [])
                return
            }
            const dist = Math.floor(Util.distanceTo(player.location, loc))
            for (let i = 0; i < dist; i++) {
                TwUtil.placeBlock(player, { x: loc.x, y: loc.y + i, z: loc.z });
            }
        }
        if (mode === 6) {
            let history = planeConstraint.get(player.id) || [];
            if (history.length < 2) continue;

            const pLoc = player.location;
            const px = Math.floor(pLoc.x);
            const pz = Math.floor(pLoc.z);
            const [historyData, fixedY] = history;

            if (Array.isArray(historyData)) {
                // 【フェーズ2: スイープ】自分の位置(px, pz)を基準にブラシを並行移動
                const offsets = historyData;

                for (const off of offsets) {
                    const tx = px + off.dx;
                    const tz = pz + off.dz;
                    // 足元スタック防止
                    if (tx === px && tz === pz) continue;
                    TwUtil.placeBlock(player, { x: tx, y: fixedY, z: tz });
                }
            } else {
                // 【フェーズ1: 定義】基点(O)から自分の今の位置(px, pz)まで線を伸ばす
                const [ox, oy, oz] = history;
                const ddx = px - ox;
                const ddz = pz - oz;
                const steps = Math.max(Math.abs(ddx), Math.abs(ddz));
                for (let i = 0; i <= steps; i++) {
                    const t = steps === 0 ? 0 : i / steps;
                    const tx = Math.floor(ox + ddx * t);
                    const tz = Math.floor(oz + ddz * t);
                    // 足元スタック防止
                    if (tx === px && tz === pz) continue;
                    TwUtil.placeBlock(player, { x: tx, y: oy, z: tz });
                }
            }
        }
    }
}, 1)
world.afterEvents.playerSwingStart.subscribe((ev) => {
    const player = ev.player;
    if (ev.swingSource == "Build") return;
    const mode = modeswitch.get(player.id);
    if (!mode) return;
    modeswitch.set(player.id, 0)
    planeConstraint.set(player.id, [])
})
changeMainItem.call((ev) => {
    const player = ev.player;
    const mode = modeswitch.get(player.id);
    if (!mode) return;
    modeswitch.set(player.id, 0)
    planeConstraint.set(player.id, [])

})
