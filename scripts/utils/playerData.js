import * as server from "@minecraft/server";
import { Dypro } from "./dypro.js";
import { Util } from "./util.js";
import { default as config } from "../config/config.js";
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
            money: config.initialMoney,
            job: undefined,//levelはこのの中にobjectとして入れる
            permission: "",
            secondname: {
                before: ["一般的な"],
                after: ["鯖民"],
                now: [0, 0]
            },
            stock: {},
            chattype: "world"
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
        else {
            player.addTag("cw:duringwar")
        }


    }
})

world.afterEvents.playerLeave.subscribe(ev => {
    const playerId = ev.playerId;
    const data = new ShortPlayerData(playerId);
    data.set("tpa", []);
    data.set("tpaRequest", []);
});

function DoInitialSpawn(player) {
    player.sendMessage({ translate: "cw.initialSpawn" })
}

const shortPlayerDypro = new Dypro("shortPlayer");

export class ShortPlayerData {
    constructor(playerId) {
        this.id = playerId;
    }
    set(key, data) {
        let currentData = shortPlayerDypro.get(this.id) || {};
        currentData[key] = data;
        shortPlayerDypro.set(this.id, currentData);
    }
    get(key) {
        const currentData = shortPlayerDypro.get(this.id);
        if (!currentData) return undefined;
        return currentData[key];
    }
    remove(key, secondkey = undefined) {
        let currentData = shortPlayerDypro.get(this.id);
        if (!currentData) return;
        if (secondkey) {
            if (currentData[key]) {
                delete currentData[key][secondkey];
                shortPlayerDypro.set(this.id, currentData);
            }
        } else {
            shortPlayerDypro.delete(this.id);
        }
    }
    clear() {
        shortPlayerDypro.delete(this.id);
    }
}

// 常に全プレイヤーに体力増強（体力上限40）エフェクトを付与し続ける処理
system.runInterval(() => {
    for (const player of world.getAllPlayers()) {
        const effect = player.getEffect("health_boost");
        // エフェクトが存在しないか、残り時間が少ないか、レベルが足りない場合に掛け直す
        if (!effect || effect.duration < 200 || effect.amplifier < 4) {
            player.addEffect("health_boost", 20000000, { amplifier: 4, showParticles: false });
            // エフェクト付与の直後に最大体力が反映されるため、少し遅らせて全回復させる
            system.runTimeout(() => {
                const health = player.getComponent("minecraft:health");
                if (health) {
                    health.resetToMaxValue();
                }
            }, 2);
        }
    }
}, 20); // 5秒に1回チェック