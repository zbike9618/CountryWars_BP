import * as server from "@minecraft/server";
const { world, system } = server;
import { Dypro } from "./dypro";
const playerDatas = new Dypro("player");
const countryDatas = new Dypro("country");
world.beforeEvents.chatSend.subscribe((ev) => {
    const player = ev.sender;
    const message = ev.message;
    const playerData = playerDatas.get(player.id);
    const countryname = countryDatas.get(playerData.country)?.name || "§7未所属";
    ev.cancel = true;
    const secondname = playerData.secondname;
    world.sendMessage(`§r[${secondname.before[secondname.now[0]]}§r${secondname.after[secondname.now[1]]}§r][${countryname}§r] <${player.name}> ${message}`)
})