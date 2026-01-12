import { world } from "@minecraft/server"
import "./commands/command"
import "./utils/playerData"
import "./utils/interval"
import "./items/items"
import "./utils/chat"
world.afterEvents.worldLoad.subscribe(() => {
    for (const player of world.getPlayers()) {
        player.inputPermissions.setPermissionCategory(6, true)
    }
})