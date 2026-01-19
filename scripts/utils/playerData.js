import * as server from "@minecraft/server";
import { Dypro } from "./dypro.js";
import { Util } from "./util.js";
const { world, system } = server;
const playerDatas = new Dypro("player");
const countryDatas = new Dypro("country");
world.afterEvents.playerSpawn.subscribe(ev => {
    const player = ev.player;
    const initialSpawn = ev.initialSpawn;
    if (initialSpawn && !player.getDynamicProperty("initial")) {
        const playerData =
        {
            id: player.id,
            name: player.name,
            country: undefined,
            money: 0,
            job: undefined,//levelはこのの中にobjectとして入れる
            permission: "",
            secondname: {
                before: ["一般的な"],
                after: ["鯖民"],
                now: [0, 0]
            }
        }
        playerDatas.set(player.id, playerData);
        DoInitialSpawn(player);//初期スポーンメッセージ等 
        player.setDynamicProperty("initial", true);
    }
    if (initialSpawn) {
        const playerData = playerDatas.get(player.id)
        const countryData = countryDatas.get(playerData.country)
        if (countryData && countryData.warcountry.length == 0) {
            player.removeTag("cw:duringwar")
        }

    }
})

world.afterEvents.playerLeave.subscribe(ev => {
    const playerId = ev.playerId;
    shortPlayerDatas.delete(playerId)
})

function DoInitialSpawn(player) {
    player.sendMessage({ translate: "cw.initialSpawn" })
}
const shortPlayerDatas = new Map();
export class ShortPlayerData {
    constructor(playerId) {
        this.id = playerId
    }
    set(key, data) {
        const d = Object.assign(shortPlayerDatas.get(this.id) || {}, { [key]: data })
        shortPlayerDatas.set(this.id, d)
    }
    get(key) {
        const getData = shortPlayerDatas.get(this.id)
        return getData ? getData[key] : undefined;
    }
    remove(key, secondkey = undefined) {
        if (secondkey) {
            const getData = shortPlayerDatas.get(this.id)
            if (getData) {
                delete getData[key][secondkey]
            }
        }
        else {
            shortPlayerDatas.delete(this.id)
        }
    }
    clear() {
        shortPlayerDatas.delete(this.id)
    }
}