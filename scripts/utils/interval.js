import * as server from "@minecraft/server";
const { world, system } = server;
import { ShortPlayerData } from "./playerData";
import { Dypro } from "./dypro";
import { Chunk } from "./chunk";
const countryDatas = new Dypro("country");
world.afterEvents.worldLoad.subscribe(() => {

    system.runInterval(() => {
        for (const player of world.getAllPlayers()) {
            const chunkId = Chunk.positionToChunkId(player.location);
            const chunk = Chunk.checkChunk(chunkId)
            const playerData = new ShortPlayerData(player.id)

            if (chunk == playerData.get("DisplayChunk")) continue;
            if (chunk == "wasteland") {
                player.onScreenDisplay.setActionBar({ translate: "cw.chunk.actionbar.wasteland" })
            }
            else {
                const countryData = countryDatas.get(chunk)
                player.onScreenDisplay.setTitle({ text: countryData.name }, { fadeInDuration: 5, fadeOutDuration: 40, stayDuration: 20, subtitle: { text: countryData.description } })
            }
            playerData.set("DisplayChunk", chunk)
        }
    }, 30)
})