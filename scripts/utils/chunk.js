import * as server from "@minecraft/server";
const { world, system } = server;
import { MessageFormData } from "@minecraft/server-ui"
import { Dypro } from "./dypro"
import { Util } from "./util";
import config from "../config/config"
const countryDatas = new Dypro("country")
const playerDatas = new Dypro("player")
const explosionMap = new Map();



export class Chunk {
    static positionToChunkId(position) {//xを少数切り捨て
        const x = Math.floor(position.x / 16)
        const z = Math.floor(position.z / 16)
        return `${x}_${z}`
    }
    static checkChunk(chunkId) {
        const chunks = JSON.parse(world.getDynamicProperty(`chunk`) || "[]");
        const found = chunks.find(c => c.id === chunkId);
        if (found && !countryDatas.get(found.country)) {
            chunks.splice(chunks.indexOf(found), 1)
            world.setDynamicProperty(`chunk`, JSON.stringify(chunks))
            return "wasteland";
        }
        return found ? found.country : "wasteland";
    }
    static async buy(player, countryData) {
        const playerData = playerDatas.get(player.id)
        if (!playerData.country) {
            player.sendMessage({ translate: "cw.form.unjoincountry" })
            return;
        }
        if (countryData.chunkAmount >= config.maxchunk) {
            player.sendMessage({ translate: "cw.chunk.buy.maxchunk", with: [`${config.maxchunk}`] })
            return;
        }
        const cc = this.checkChunk(this.positionToChunkId(player.location))
        if (cc !== "wasteland") {
            player.sendMessage({ translate: "cw.chunk.buy.already", with: [countryDatas.get(cc)?.name || "Unknown"] })
            return;
        }
        const form = new MessageFormData()
        form.title({ translate: "cw.chunk.buy.title" })
        form.body({ translate: "cw.chunk.buy.body", with: [`${config.chunkprice}`, `${countryData.money}`] })
        form.button1({ translate: "cw.form.buy" })
        form.button2({ translate: "cw.form.cancel" })
        const res = await form.show(player)
        if (res.canceled) return;
        if (res.selection === 0) {

            if (countryData.money < config.chunkprice) {
                player.sendMessage({ translate: "cw.form.nomoney" })
                return;
            }

            player.sendMessage({ translate: "cw.chunk.buy.success" })
            countryData.money -= config.chunkprice;
            countryDatas.set(countryData.id, countryData)
            this.setChunk(this.positionToChunkId(player.location), countryData)

        }
    }
    static async sell(player, chunkId) {
        const chunks = JSON.parse(world.getDynamicProperty(`chunk`) || "[]");
        const found = chunks.find(c => c.id === chunkId);
        if (!found) {
            player.sendMessage({ translate: "cw.chunk.sell.notfound" })
            return;
        }
        const countryData = countryDatas.get(found.country)
        if (!countryData) {
            player.sendMessage({ translate: "cw.chunk.sell.notfound" })
            return;
        }
        const form = new MessageFormData()
        form.title({ translate: "cw.chunk.sell.title" })
        form.body({ translate: "cw.chunk.sell.check", with: [`${config.chunkprice / 2}`] })
        form.button1({ translate: "cw.form.sell" })
        form.button2({ translate: "cw.form.cancel" })
        const res = await form.show(player)
        if (res.canceled) return;
        if (res.selection === 0) {
            const playerData = playerDatas.get(player.id)
            player.sendMessage({ translate: "cw.chunk.sell.success", with: [`${countryData.money}`, `${countryData.money + config.chunkprice / 2}`] })
            countryData.money += config.chunkprice / 2;
            countryData.chunkAmount -= 1;
            countryDatas.set(countryData.id, countryData)
            const chunk = JSON.parse(world.getDynamicProperty(`chunk`) || "[]");
            chunk.splice(chunk.indexOf(found), 1)
            world.setDynamicProperty(`chunk`, JSON.stringify(chunk))

        }
    }
    static setChunk(chunkId, countryData) {
        const chunk = this.checkChunk(chunkId);

        const enemyData = countryDatas.get(chunk);
        const chunks = JSON.parse(world.getDynamicProperty(`chunk`) || "[]");
        if (chunk != "wasteland") {
            if (chunks.map(c => c.id).includes(chunkId)) {
                chunks.splice(chunks.map(c => c.id).indexOf(chunkId), 1)
                enemyData.chunkAmount -= 1;
                countryDatas.set(enemyData.id, enemyData)
            }
        }
        chunks.push({
            id: chunkId,
            country: countryData.id
        })
        world.setDynamicProperty(`chunk`, JSON.stringify(chunks))
        countryData.chunkAmount += 1;
        countryDatas.set(countryData.id, countryData)

    }
}
world.beforeEvents.playerBreakBlock.subscribe((ev) => {
    const player = ev.player
    const playerData = playerDatas.get(player.id)
    if (!playerData.country) return;
    const loc = ev.block.location
    const chunkId = Chunk.positionToChunkId(loc)
    const countryData = Chunk.checkChunk(chunkId)
    if (playerData.country !== countryData && countryData !== "wasteland") {

        player.sendMessage({ translate: "cw.chunk.break", with: [countryDatas.get(countryData).name] })

        ev.cancel = true

    }

})
world.beforeEvents.playerPlaceBlock.subscribe((ev) => {
    const player = ev.player
    const playerData = playerDatas.get(player.id)
    if (!playerData.country) return;
    const loc = ev.block.location
    const chunkId = Chunk.positionToChunkId(loc)
    const countryData = Chunk.checkChunk(chunkId)
    if (playerData.country !== countryData && countryData !== "wasteland") {

        player.sendMessage({ translate: "cw.chunk.place", with: [countryDatas.get(countryData).name] })

        ev.cancel = true

    }

})
world.beforeEvents.playerInteractWithBlock.subscribe((ev) => {
    const player = ev.player
    const playerData = playerDatas.get(player.id)
    if (!playerData.country) return;
    const loc = ev.block.location
    const chunkId = Chunk.positionToChunkId(loc)
    const countryData = Chunk.checkChunk(chunkId)
    if (playerData.country !== countryData && countryData !== "wasteland") {

        player.sendMessage({ translate: "cw.chunk.place", with: [countryDatas.get(countryData).name] })

        ev.cancel = true

    }

})

world.beforeEvents.explosion.subscribe((ev) => {
    if (!ev.source) return;

    if (!explosionMap.has(ev.source.id)) {
        const blocks = ev.getImpactedBlocks();
        const dimension = ev.dimension;
        let explodedInCountry = false;
        const destroyBlockLocations = [];

        for (const block of blocks) {
            const chunkId = Chunk.positionToChunkId(block.location);
            const countryDataId = Chunk.checkChunk(chunkId);

            if (countryDataId && countryDataId !== "wasteland") {
                if (!explodedInCountry) {
                    ev.cancel = true;
                    system.run(() => {
                        dimension.createExplosion(block.location, 4, {
                            breaksBlocks: false
                        });
                    });
                    explodedInCountry = true;
                }
                if (block.typeId === "minecraft:tnt") {
                    destroyBlockLocations.push({
                        x: block.location.x,
                        y: block.location.y,
                        z: block.location.z
                    });
                }
            } else {
                // Store only the location properties
                destroyBlockLocations.push({
                    x: block.location.x,
                    y: block.location.y,
                    z: block.location.z
                });
            }
        }

        if (destroyBlockLocations.length > 0) {
            system.run(() => {
                const entity = dimension.spawnEntity("cw:explosion", { x: 0, y: 200, z: 0 });
                explosionMap.set(entity.id, destroyBlockLocations);
            });
        }
    } else {
        const locations = explosionMap.get(ev.source.id);
        const dimension = ev.dimension;
        const blocksToDestroy = [];

        for (const loc of locations) {
            const block = dimension.getBlock(loc);
            if (block) {
                blocksToDestroy.push(block);
            }
        }

        if (blocksToDestroy.length > 0) {
            ev.setImpactedBlocks(blocksToDestroy);
        }

        // Cleanup to prevent data bloat
        explosionMap.delete(ev.source.id);
    }
});