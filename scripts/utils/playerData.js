import * as server from "@minecraft/server";
import { Dypro } from "./dypro.js";
import { Util } from "./util.js";
const { world, system } = server;
const playerDatas = new Dypro("player");

world.afterEvents.playerSpawn.subscribe(ev => {
    const player = ev.player;
    const initialSpawn = ev.initialSpawn;
    if (initialSpawn) {
        const playerData =
        {
            name: player.name,
            country: undefined,
            money: 0,
            job: undefined,//levelはこのの中にobjectとして入れる
        }
        playerDatas.set(player.id, playerData);
        initialSpawn(player);//初期スポーンメッセージ等 
    }
})

function initialSpawn(player) {
    player.sendMessage({ translate: "cw.initialSpawn" })
}