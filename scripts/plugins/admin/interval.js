import * as server from "@minecraft/server";
const { world, system } = server;
import { DiscordRelay } from "../../utils/chat";
const ids = "qwertyuiopasdfghjklzxcvbnm1234567890"
function oriId() {
    let ori = "";
    const idArray = ids.split("")
    for (let i = 1; i <= 16; i++) {
        const key = Math.floor(Math.random() * idArray.length);
        ori += idArray[key];
    }
    return ori;
}
system.runInterval(() => {
    for (const player of world.getAllPlayers()) {

        const comp = player.getComponent("inventory");
        const inv = comp.container;
        const has = []
        for (let i = 0; i < inv.size; i++) {
            const item = inv.getItem(i);
            if (item) {
                if (item.maxAmount != 1) continue;
                let key = item.getDynamicProperty("cw:id");

                if (key === undefined) {
                    const newId = oriId();
                    item.setDynamicProperty("cw:id", newId);

                    inv.setItem(i, item);

                    const Haveitem = inv.getItem(i);
                    key = Haveitem ? Haveitem.getDynamicProperty("cw:id") : newId;
                }

                if (has.includes(key)) {
                    //player.runCommand("kick @s 不正なアイテムの増殖");
                    world.sendMessage(`[CountryWars]${player.name} が不正なアイテムの増殖を試みました`);
                    DiscordRelay.send(`[CountryWars]${player.name} が不正なアイテムの増殖を試みました`);
                    inv.setItem(i);
                    continue;
                }
                has.push(key);
            }
        }
    }

})