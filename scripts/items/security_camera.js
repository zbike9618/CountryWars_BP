import {
    world,
    EntityComponentTypes,
    system
} from "@minecraft/server";
import { Lore } from "../utils/Lore.js";

/* =========================================================
状態管理
========================================================= */
const lastUseTick = new Map();
const activeCameraView = new Map();

/* =========================================================
共通フェード設定
========================================================= */
const FADE_TIME = {
    fadeOutTime: 0.25,
    holdTime: 0.25,
    fadeInTime: 0.25
};

/* =========================================================
初期化：ワールド読み込み時にカメラ用tickingareaを全削除
========================================================= */
system.afterEvents.scriptEventReceive.subscribe((event) => {
    if (event.id === "minecraft:loaded") {
        cleanupAllCameraTickingAreas();
    }
});

// ワールド起動時にも実行
system.run(() => {
    cleanupAllCameraTickingAreas();
});

function cleanupAllCameraTickingAreas() {
    const dimensions = [
        world.getDimension("overworld"),
        world.getDimension("nether"),
        world.getDimension("the_end")
    ];


    for (const dimension of dimensions) {
        try {
            // コマンドで全tickingareaをリスト取得して削除
            const result = dimension.runCommand("tickingarea list all-dimensions");

            // cam_ で始まるエリアを全て削除
            dimension.runCommand("execute as @a run function cleanup_camera_areas");

            // 直接削除を試みる（cam_で始まる名前のパターン）
            // プレイヤーIDは予測できないので、リストから取得が必要
            // ここでは単純にエラーを無視しながら削除を試みる
        } catch (error) {
            // 無視
        }
    }

    // スクリプトAPIでも試行
    cleanupViaScriptAPI();


}

async function cleanupViaScriptAPI() {
    try {
        const tickingAreaManager = world.tickingAreaManager;
        const areas = await tickingAreaManager.getAll();


        for (const area of areas) {
            // cam_ で始まるエリアを削除
            if (area.name && area.name.startsWith("cam_")) {
                try {
                    await tickingAreaManager.remove(area);
                    console.warn(`Removed camera ticking area: ${area.name}`);
                } catch (error) {
                    // 無視
                }
            }
        }
    } catch (error) {
        console.warn("TickingArea cleanup via API failed:", error);
    }


}

/* =========================================================
tickingarea 制御（スクリプトAPI使用）
========================================================= */
async function addCameraTickingArea(player, loc) {
    const name = `cam_${player.id}`;
    const x = Math.floor(loc.x);
    const y = Math.floor(loc.y);
    const z = Math.floor(loc.z);


    try {
        const tickingAreaManager = world.tickingAreaManager;

        // 既存の同名エリアを削除
        const existingAreas = await tickingAreaManager.getAll();
        for (const area of existingAreas) {
            if (area.name === name) {
                await tickingAreaManager.remove(area);
            }
        }

        // 新しいtickingareaを追加
        await tickingAreaManager.add(name, { x, y, z }, { x, y, z });
    } catch (error) {
        console.warn("TickingArea add failed:", error);
        // フォールバック: コマンドを使用
        player.runCommand(
            `tickingarea add ${x} ${y} ${z} ${x} ${y} ${z} ${name}`
        );
    }


}

async function removeCameraTickingArea(player) {
    const name = `cam_${player.id}`;


    try {
        const tickingAreaManager = world.tickingAreaManager;
        const areas = await tickingAreaManager.getAll();

        for (const area of areas) {
            if (area.name === name) {
                await tickingAreaManager.remove(area);
            }
        }
    } catch (error) {
        console.warn("TickingArea remove failed:", error);
        // フォールバック: コマンドを使用
        player.runCommand(`tickingarea remove ${name}`);
    }


}

/* =========================================================
カメラ開始
========================================================= */
function startCameraView(player, loc) {
    if (activeCameraView.has(player.id)) return;


    activeCameraView.set(player.id, {
        loc,
        active: false,
        playerInstance: player
    });

    player.camera.fade({
        fadeColor: { red: 0, green: 0, blue: 0 },
        fadeTime: FADE_TIME
    });

    system.runTimeout(() => {
        player.camera.setCamera("minecraft:free", {
            location: {
                x: loc.x + 0.5,
                y: loc.y + 0.5,
                z: loc.z + 0.5
            }
        });

        const data = activeCameraView.get(player.id);
        if (data) data.active = true;

        player.sendMessage({ translate: "cw.camera_view_started" });
    }, 5);


}

/* =========================================================
カメラ終了
========================================================= */
function endCameraView(player) {
    if (!activeCameraView.has(player.id)) return;


    activeCameraView.delete(player.id);
    removeCameraTickingArea(player);

    player.camera.fade({
        fadeColor: { red: 0, green: 0, blue: 0 },
        fadeTime: FADE_TIME
    });

    system.runTimeout(() => {
        player.camera.clear();
        player.sendMessage({ translate: "cw.camera_view_ended" });
    }, 5);


}

/* =========================================================
アイテム使用
========================================================= */
world.afterEvents.itemUse.subscribe((event) => {
    const player = event.source;
    const item = event.itemStack;
    if (!player || !item) return;
    if (item.typeId !== "cw:security_camera_item") return;


    const now = system.currentTick;
    const last = lastUseTick.get(player.id);
    if (last !== undefined && now - last < 5) return;
    lastUseTick.set(player.id, now);

    const hit = player.getBlockFromViewDirection({ maxDistance: 8 });

    /* ---------- カメラ登録 ---------- */
    if (hit?.block?.typeId === "cw:security_camera") {
        const loc = hit.block.location;
        const coord = `${loc.x} ${loc.y} ${loc.z}`;

        const slot = player.selectedSlotIndex;
        const currentLore = Lore.getLore(player, slot, "camera");
        if (currentLore === coord) return;

        Lore.setLore(player, slot, "camera", coord);

        player.sendMessage({
            translate: "cw.camera_registered",
            with: [coord]
        });
        return;
    }

    /* ---------- 視点切替 ---------- */
    const slot = player.selectedSlotIndex;
    const cameraCoord = Lore.getLore(player, slot, "camera");
    if (!cameraCoord) {
        player.sendMessage({ translate: "cw.no_camera_registered" });
        return;
    }

    const [x, y, z] = cameraCoord.split(" ").map(Number);
    const camLoc = { x, y, z };

    // 先に tickingarea を追加
    addCameraTickingArea(player, camLoc);

    system.runTimeout(() => {
        const block = player.dimension.getBlock(camLoc);

        if (!block || block.typeId !== "cw:security_camera") {
            removeCameraTickingArea(player);

            Lore.removeLore(player, slot, "camera");

            player.sendMessage({ translate: "cw.camera_not_found" });
            return;
        }

        startCameraView(player, camLoc);
    }, 5);


});

/* =========================================================
定期監視（視点同期）
========================================================= */
system.runInterval(() => {
    for (const [playerId, data] of activeCameraView) {
        const player = data.playerInstance;
        if (!player || !player.isValid() || !data.active) continue;
        const loc = data.loc;


        if (player.isSneaking) {
            endCameraView(player);
            continue;
        }

        const block = player.dimension.getBlock(loc);
        if (!block || block.typeId !== "cw:security_camera") {
            endCameraView(player);
            player.sendMessage({ translate: "cw.camera_broken" });
            continue;
        }

        const rot = player.getRotation();
        player.camera.setCamera("minecraft:free", {
            location: {
                x: loc.x + 0.5,
                y: loc.y + 0.5,
                z: loc.z + 0.5
            },
            rotation: {
                x: rot.x,
                y: rot.y
            }
        });
    }


}, 1);

/* =========================================================
プレイヤー退出時
========================================================= */
world.afterEvents.playerLeave.subscribe(async (event) => {
    const { playerId } = event;


    if (activeCameraView.has(playerId)) {
        activeCameraView.delete(playerId);
    }

    // tickingareaの削除（コマンド経由）
    const name = `cam_${playerId}`;

    // システムで次のティックに実行（安全のため）
    system.run(() => {
        // 適当なプレイヤーを経由してコマンドを実行
        const players = world.getAllPlayers();
        if (players.length > 0) {
            try {
                players[0].runCommand(`tickingarea remove ${name}`);
            } catch (error) {
                // エリアが存在しない場合はエラーが出るが問題なし
            }
        } else {
            // プレイヤーがいない場合はディメンション経由
            try {
                world.getDimension("overworld").runCommand(`tickingarea remove ${name}`);
            } catch (error) {
                // 無視
            }
        }
    });


});
