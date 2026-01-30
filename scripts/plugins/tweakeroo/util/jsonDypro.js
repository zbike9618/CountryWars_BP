import * as server from "@minecraft/server"
const { world, system } = server;
export class JsonDypro {
    constructor(key) {
        this.key = key;
    }
    /**
     * @param {import("@minecraft/server").Player} player
     * @param {string} key2
     * @param {any} value
     */
    set(player, key2, value) {
        const data = player.getDynamicProperty(this.key)
        if (!data) {
            player.setDynamicProperty(this.key, JSON.stringify({ [key2]: value }))
            return
        }
        const json = JSON.parse(data)
        json[key2] = value
        player.setDynamicProperty(this.key, JSON.stringify(json))
    }
    /**
     * @param {import("@minecraft/server").Player} player
     * @returns {any}
     */
    get(player) {
        if (!player.getDynamicProperty(this.key)) {
            return undefined
        }
        return JSON.parse(player.getDynamicProperty(this.key))
    }
}