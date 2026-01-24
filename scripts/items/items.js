import { world, system, } from "@minecraft/server";
import "./kaihuku_kit.js";
import "./xp_box.js";
import "./mega_item.js";
import "./shinai.js";
import "./security_camera.js";
import "./magnet.js"
import "./fertilizer.js"
import "./dice.js";
import "./platinum_armor.js";
import "./fabric_armor.js";

world.afterEvents.worldLoad.subscribe((event) => {


    system.runInterval(() => {
        for (const player of world.getAllPlayers()) {
            const comp = player.getComponent("minecraft:equippable")
            if (!comp) return;
            const item = comp.getEquipment("Head")
            if (!item) return;
            if (item.typeId == "cw:anshi_goggle") {
                player.addEffect("minecraft:night_vision", 240, {
                    amplifier: 0,
                    showParticles: false
                })
            }
        }

    }, 20)
});




