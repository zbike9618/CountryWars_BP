import * as server from "@minecraft/server";
const { system } = server;
import { Dypro } from "../utils/dypro.js";
import { Chunk } from "../utils/chunk.js";

const playerDatas = new Dypro("player");
const countryDatas = new Dypro("country");
const chunkDatas = new Dypro("chunk");

system.beforeEvents.startup.subscribe(ev => {
    const mapCommand = {
        name: "cw:map",
        description: "周辺チャンクのマップを表示する",
        permissionLevel: server.CommandPermissionLevel.Any,
        mandatoryParameters: [],
        optionalParameters: [],
    };

    ev.customCommandRegistry.registerCommand(mapCommand, showMap);
});

function showMap(origin) {
    if (origin.sourceEntity?.typeId !== "minecraft:player") {
        return {
            status: server.CustomCommandStatus.Failure,
            message: "実行者はプレイヤーである必要があります",
        };
    }

    const player = origin.sourceEntity;

    system.run(() => {
        const playerData = playerDatas.get(player.id);
        const myCountryId = playerData?.country ?? null;
        const myCountryData = myCountryId ? countryDatas.get(myCountryId) : null;

        // 自国の外交リストを取得
        const allyIds   = myCountryData?.diplomacy?.ally   ?? [];
        const enemyIds  = myCountryData?.diplomacy?.enemy  ?? [];
        const friendIds = myCountryData?.diplomacy?.friend ?? [];

        // プレイヤーの現在チャンク座標を計算
        const { x: rawX, z: rawZ } = player.location;
        const currentX = Math.floor(rawX / 16);
        const currentZ = Math.floor(rawZ / 16);

        // 21×21 のマップを生成
        const rows = [];
        for (let i = -10; i <= 10; i++) {
            const cells = [];
            for (let j = -10; j <= 10; j++) {
                const chunkX = currentX + j;
                const chunkZ = currentZ + i;
                const chunkId = Chunk.positionToChunkId(
                    { x: chunkX * 16, z: chunkZ * 16 },
                    player.dimension.id
                );
                const chunkData = chunkDatas.get(chunkId);
                const ownerCountryId = chunkData?.country ?? null;

                // 色コードの決定
                let color = "f"; // 未領土（白）

                if (i === 0 && j === 0) {
                    color = "4"; // 自分の位置（赤）
                } else if (ownerCountryId) {
                    color = "e"; // 他国（黄）
                    if (ownerCountryId === myCountryId && myCountryId) {
                        color = "a"; // 自国（緑）
                    } else if (allyIds.includes(ownerCountryId)) {
                        color = "b"; // 同盟国（水色）
                    } else if (enemyIds.includes(ownerCountryId)) {
                        color = "c"; // 敵対国（赤）
                    } else if (friendIds.includes(ownerCountryId)) {
                        color = "d"; // 友好国（紫）
                    }
                }

                cells.push(`§${color}■`);
            }
            rows.push(cells.join(""));
        }

        // 凡例
        const legend = [
            "§4■§r 自分の位置",
            "§a■§r 自国",
            "§b■§r 同盟国",
            "§d■§r 友好国",
            "§e■§r 他国",
            "§c■§r 敵対国",
            "§f■§r 未領土",
        ].join("  ");

        const separator = "§8" + "─".repeat(21);
        player.sendMessage(
            `${separator}\n${rows.join("\n")}\n${separator}\n${legend}`
        );

        player.teleport(player.location, { rotation: { x: 0, y: player.getRotation().y } });
    });

    return {
        status: server.CustomCommandStatus.Success,
        message: undefined,
    };
}
