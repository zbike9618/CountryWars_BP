import { world, system, Player } from "@minecraft/server";
import { Util } from "../utils/util";
const cooldowns = new Map();
/**
 * 回復する関数
 * @param {*} entity 
 * @param {*} number 
 * @returns 
 */
function heal(entity, number = 0) {
    try {
        const comp = entity.getComponent("minecraft:health")
        const value = comp.currentValue
        let all = value + number
        if (comp.effectiveMax < all) {
            all = comp.effectiveMax
        }
        comp.setCurrentValue(all)
        return true;
    }
    catch (c) {
        return false;
    }
}

const healArray = [10, 25, 40]
/**
 * 
 * @param {Player} player 
 * @param {*} number 
 * @param {*} item 
 */
async function kaihuku(player, number) {
    player.playSound("mob.shulker.shoot");
    player.sendMessage(`回復キット <Level ${number}>を使用…`);
    player.runCommand(`clear @s cw:kaihuku_kit${number} 0 1`)
    player.inputPermissions.setPermissionCategory(6, false)
    player.addEffect("slowness", 20 * number, {
        amplifier: 255, showParticles: false
    });
    await system.waitTicks(20 * number)
    player.playSound("random.levelup");
    heal(player, healArray[number - 1])
    player.inputPermissions.setPermissionCategory(6, true)

}
//スマホ使用時
world.afterEvents.itemUse.subscribe((event) => {
    const player = event.source;
    const item = event.itemStack;
    const playerId = event.source.id;
    if (item.typeId.includes("kaihuku_kit")) {
        if (cooldowns.has(playerId)) {
            player.sendMessage("§cまだ使用できません！");
            return;
        } else {
            const number = item.typeId.replace("cw:kaihuku_kit", "");
            player.playSound("mob.shulker.shoot");
            kaihuku(player, Number(number));
        }
    }
    cooldowns.set(playerId, true);
    system.runTimeout(() => {
        cooldowns.delete(playerId);
    }, 30); // 100tick = 5秒
});