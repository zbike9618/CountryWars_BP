import { world } from "@minecraft/server"
import "./commands/command"
import "./utils/playerData"
import "./utils/interval"
import "./items/items"

world.afterEvents.worldLoad.subscribe(() => {
    for (const player of world.getPlayers()) {
        player.inputPermissions.setPermissionCategory(6, true)
    }
})