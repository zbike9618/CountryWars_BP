import * as server from "@minecraft/server";
const { world, system } = server;
import { MessageFormData } from "@minecraft/server-ui"
import { Dypro } from "./dypro"
import { Util } from "./util";
import config from "../config/config"
const countryDatas = new Dypro("country")
const playerDatas = new Dypro("player")



export class Chunk {
    static positionToChunkId(position) {//xを少数切り捨て
        const x = Math.floor(position.x / 16)
        const z = Math.floor(position.z / 16)
        return `${x}_${z}`
    }
    static checkChunk(chunkId) {
        const chunks = JSON.parse(world.getDynamicProperty(`chunk`) || "[]");
        const found = chunks.find(c => c.id === chunkId);
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
        form.body({ translate: "cw.chunk.buy.body", with: [`${config.chunkprice}`, `${playerData.money}`] })
        form.button1({ translate: "cw.form.buy" })
        form.button2({ translate: "cw.form.cancel" })
        const res = await form.show(player)
        if (res.canceled) return;
        if (res.selection === 0) {

            if (playerData.money < config.chunkprice) {
                player.sendMessage({ translate: "cw.form.nomoney" })
                return;
            }

            player.sendMessage({ translate: "cw.chunk.buy.success" })
            Util.addMoney(player, -config.chunkprice)

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
        if (chunk == "wasteland") return;
        const enemyData = countryDatas.get(chunk);
        const chunks = JSON.parse(world.getDynamicProperty(`chunk`) || "[]");
        if (chunks.map(c => c.id).includes(chunkId)) {
            chunks.splice(chunks.map(c => c.id).indexOf(chunkId), 1)
            enemyData.chunkAmount -= 1;
            countryDatas.set(enemyData.id, enemyData)
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