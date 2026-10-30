import * as server from "@minecraft/server";
const { world, system } = server;
export class Lore {
    /**
     * 
     * @param {server.Player} player 
     * @param {number} slot 
     * @param {String} loreId 
     * @param {String} data 
     */
    static setLore(player, slot, loreId, data) {
        const container = player.getComponent("inventory").container
        const item = container.getItem(slot)
        if (!item) return;
        let lore = item.getLore()
        if (lore.find(l => l.split(":")[0].trim() == loreId)) {
            lore = lore.map(l => l.split(":")[0].trim() == loreId ? `${loreId}:${data}` : l)
        } else {
            lore.push(`${loreId}:${data}`)
        }
        item.setLore(lore)
        container.setItem(slot, item)
    }
    static getLore(player, slot, loreId) {
        const container = player.getComponent("inventory").container
        const item = container.getItem(slot)
        if (!item) return;
        const lore = item.getLore()
        const line = lore.find(l => {
            const key = l.split(":")[0].replace(/§[0-9a-fk-or]/gi, "").trim();
            return key == loreId;
        })
        if (line) {
            const colonIndex = line.indexOf(":");
            return line.slice(colonIndex + 1).trim();
        }
    }
    static removeLore(player, slot, loreId) {
        const container = player.getComponent("inventory").container
        const item = container.getItem(slot)
        if (!item) return;
        let lore = item.getLore()
        lore = lore.filter(l => {
            const key = l.split(":")[0].replace(/§[0-9a-fk-or]/gi, "").trim();
            return key !== loreId;
        })
        item.setLore(lore)
        container.setItem(slot, item)
    }
    static hasLore(player, slot, loreId) {
        const container = player.getComponent("inventory").container
        const item = container.getItem(slot)
        if (!item) return false;
        const lore = item.getLore()
        return lore.some(l => {
            const key = l.split(":")[0].replace(/§[0-9a-fk-or]/gi, "").trim();
            return key == loreId;
        })
    }
}