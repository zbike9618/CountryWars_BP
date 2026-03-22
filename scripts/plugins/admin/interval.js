import * as server from "@minecraft/server";
const { world, system } = server;
import { Lore } from "../../utils/lore";
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
        try {
            const comp = player.getComponent("inventory");
            const inv = comp.container;
            const has = []
            for (let i = 0; i < inv.size; i++) {
                const item = inv.getItem(i);
                if (item) {
                    let key = Lore.getLore(player, i, "id:");

                    if (!key) {
                        const newId = oriId();
                        Lore.setLore(player, i, "id:", newId);
                        key = newId;
                    }

                    if (has.includes(key)) {
                        //player.runCommand("kick @s 不正なアイテムの増殖");
                        inv.setItem(i);
                        continue;
                    }
                    has.push(key);
                }
            }
        } catch (error) {
            world.sendMessage(error);
        }
    }
})