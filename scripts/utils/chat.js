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
    ev.cancel = true;
    world.sendMessage(`[${countryname}§r] <${player.name}> ${message}`)
})