import * as server from "@minecraft/server";
const { world, system } = server;
import { Dypro } from "./dypro";
const playerDatas = new Dypro("player");
const countryDatas = new Dypro("country");
world.beforeEvents.chatSend.subscribe((ev) => {
    const player = ev.sender;
    const message = ev.message;
    const playerData = playerDatas.get(player.id).country;
    const countryname = countryDatas.get(playerData)?.name || "§7未所属";
    const playerData2 = playerDatas.get(player.id)
    const now = playerData2.secondname.now ;
    ev.cancel = true;
    world.sendMessage(`[${countryname}§r:${playerData2?.secondname.before[now[0]]+playerData2?.secondname.after[now[1]]}] <${player.name}> ${message} `)
})