import * as server from "@minecraft/server";
const { world, system } = server;
import { ShortPlayerData } from "./playerData";
import { Dypro } from "./dypro";
import { Chunk } from "./chunk";
import config from "../config/config";
import { sendDataForPlayers } from "./sendData";
import { Country } from "./country";
import { Util } from "./util";
const countryDatas = new Dypro("country");
const playerDatas = new Dypro("player");
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
    //国からの税金の徴収
    system.runInterval(() => {
        const time = new Date()
        time.setHours(time.getHours() + 9)//時差
        const hour = time.getHours()
        const minute = time.getMinutes()
        const second = time.getSeconds()
        if (hour == 20) {
            if (minute == 0 && second == 0) {
                world.sendMessage({ translate: "cw.tax.timenear", with: [`1時間`] })
            }
            if (minute == 30 && second == 0) {
                world.sendMessage({ translate: "cw.tax.timenear", with: [`30分`] })
            }
            if (minute == 50 && second == 0) {
                world.sendMessage({ translate: "cw.tax.timenear", with: [`10分`] })
            }
        }

        if (hour == 21 && minute == 0 && second == 0) {
            for (const countryId of countryDatas.idList) {
                const countryData = countryDatas.get(countryId)
                //維持費の前に税金を徴収する
                if (countryData.tax.country != 0) {
                    for (const playerId of countryData.players) {
                        const playerData = playerDatas.get(playerId)
                        const tax = playerData.money * (countryData.tax.country / 100);
                        countryData.money += tax;
                        playerData.money -= tax;
                        playerDatas.set(playerId, playerData)
                        const data = `world.getEntity("${playerId}").sendMessage({translate: "cw.tax.levy", with: ["${tax}"]})`
                        sendDataForPlayers(data, playerId)
                    }
                }
                const pay = config.maintenance * countryData.chunkAmount
                if (pay > countryData.money) {
                    world.sendMessage({ translate: "cw.tax.maintenance.fail", with: [countryData.name] })
                    Country.delete(countryData)
                    continue;
                }
                if (pay == 0) continue;
                countryData.money -= pay
                for (const player of Util.GetCountryPlayer(countryData)) {
                    player.sendMessage({ translate: "cw.tax.maintenance.success", with: [countryData.name, `${pay}`] })
                }
                countryDatas.set(countryId, countryData)
            }
        }
    }, 20)
})

