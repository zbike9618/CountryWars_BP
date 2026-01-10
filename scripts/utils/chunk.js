import * as server from "@minecraft/server";
const { world, system } = server;
import { MessageFormData } from "@minecraft/server-ui"
import { Dypro } from "./dypro"
import { Util } from "./util";
import config from "../config/config"
const countryDatas = new Dypro("country")
const playerDatas = new Dypro("player")



export class Chunk {
    static positionToChunkId(position) {
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
        const cc = this.checkChunk(this.positionToChunkId(player.location))
        if (cc !== "wasteland") {
            player.sendMessage({ translate: "cw.chunk.buy.already", with: [countryDatas.get(cc)?.name || "Unknown"] })
            return;
        }
        const playerData = playerDatas.get(player.id)
        const form = new MessageFormData()
        form.title({ translate: "cw.chunk.buy.title" })
        form.body({ translate: "cw.chunk.buy.body", with: [`${config.chunkprice}`, `${playerData.money}`] })
        form.button1({ translate: "cw.form.buy" })
        form.button2({ translate: "cw.form.cancel" })
        const res = await form.show(player)
        if (res.canceled) return;
        if (res.selection === 0) {

            if (playerData.money < config.chunkprice) {
                player.sendMessage({ translate: "cw.chunk.buy.nomoney" })
                return;
            }

            player.sendMessage({ translate: "cw.chunk.buy.success" })
            Util.addMoney(player, -config.chunkprice)

            countryData.chunkAmount += 1;
            countryDatas.set(countryData.id, countryData)
            const chunk = JSON.parse(world.getDynamicProperty(`chunk`) || "[]");
            chunk.push({
                id: this.positionToChunkId(player.location),
                country: countryData.id
            })
            world.setDynamicProperty(`chunk`, JSON.stringify(chunk))

        }
    }
    static sell(player, chunkId) {
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
        const playerData = playerDatas.get(player.id)
        player.sendMessage({ translate: "cw.chunk.sell.success", with: [`${playerData.money}`, `${playerData.money + config.chunkprice / 2}`] })
        Util.addMoney(player, config.chunkprice / 2)
        countryData.chunkAmount -= 1;
        countryDatas.set(countryData.id, countryData)
        const chunk = JSON.parse(world.getDynamicProperty(`chunk`) || "[]");
        chunk.splice(chunk.indexOf(found), 1)
        world.setDynamicProperty(`chunk`, JSON.stringify(chunk))
    }
}

