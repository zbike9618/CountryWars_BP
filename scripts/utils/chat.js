import * as server from "@minecraft/server";
const { world, system } = server;
import { Dypro } from "./dypro";
import config from "../config/config";
const playerDatas = new Dypro("player");
const countryDatas = new Dypro("country");
world.beforeEvents.chatSend.subscribe((ev) => {
    const player = ev.sender;
    const message = ev.message;
    const playerData = playerDatas.get(player.id);
    const countryname = countryDatas.get(playerData.country)?.name || "§7未所属";
    ev.cancel = true;
    let chatType = "";
    switch (playerData.chattype) {
        case "world":
            chatType = "§aW";
            break;
        case "country":
            chatType = "§eC";
            break;
        case "local":
            chatType = "§cL";
            break;
    }
    const secondname = playerData.secondname;
    const send = `[${chatType}§r][${secondname.before[secondname.now[0]]}§r${secondname.after[secondname.now[1]]}§r][${countryname}§r] <${player.name}> ${message}`
    switch (playerData.chattype) {
        case "world":
            for (const pc of world.getAllPlayers()) {
                pc.sendMessage(send)
            }
            break;
        case "country":
            for (const pc of world.getAllPlayers().filter(p => playerDatas.get(p.id).country == playerData.country)) {
                pc.sendMessage(send)
            }
            break;
        case "local":
            for (const pc of world.getPlayers({ location: player.location, maxDistance: config.localChatDistance })) {
                pc.sendMessage(send)
            }
            break;
    }




})
export function ChangeChatType(player, type) {
    const playerData = playerDatas.get(player.id);
    if (playerData.chattype == type) {
        player.sendMessage({ translate: "cw.chattype.already", with: [type] });
        player.playSound("note.bass")
        return;
    }
    playerData.chattype = type;
    playerDatas.set(player.id, playerData);
    player.sendMessage({ translate: "cw.chattype.changed", with: [type] });
    player.playSound("random.orb")
}
function ArrayFilter(array, key) {
    return array.filter(p => playerDatas.get(p.id).chattype == key)
}
