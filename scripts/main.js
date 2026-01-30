import { world } from "@minecraft/server"
import "./commands/command"
import "./utils/playerData"
import "./utils/interval"
import "./items/items"
import "./utils/chat"
import "./utils/bank"
import "./plugin_controller"
world.afterEvents.worldLoad.subscribe(() => {
    for (const player of world.getAllPlayers()) {
        player.inputPermissions.setPermissionCategory(6, true)
    }
})