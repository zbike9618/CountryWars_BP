import { world,system } from "@minecraft/server";

const cooldowns = new Map();
/**
 * 回復する関数
 * @param {*} entity 
 * @param {*} number 
 * @returns 
 */
function heal(entity,number = 0)
{
    try 
    {
     const comp = entity.getComponent("minecraft:health")
     const value = comp.currentValue
     let all = value+number
     if(comp.effectiveMax < all)
     {
        all = comp.effectiveMax
     }
     comp.setCurrentValue(all)
     return true;
    }
    catch(c)
    {
        return false;
    }
}

async function kaihuku(entity, number2){
    const player = entity;
    player.playSound("mob.shulker.shoot");
    if(number2 == 1){
        player.sendMessage("回復キット <Level 1>を使用…");
        player.runCommand("clear @s cw:kaihuku_kit1 0 1")
        player.runCommand("inputpermission set @s jump disabled")
        player.addEffect("slowness", 20, {
        amplifier :255, showParticles: false
        });
        await system.waitTicks(20)
        heal(entity,10)
        player.runCommand("inputpermission set @s jump enabled")
    };
    if(number2 == 2){
        player.sendMessage("回復キット <Level 2>を使用…");
        player.runCommand("clear @s cw:kaihuku_kit2 0 1")
        player.runCommand("inputpermission set @s jump disabled")
        player.addEffect("slowness", 40, {
        amplifier :255, showParticles: false
        });
        await system.waitTicks(40)
        heal(entity,25)
        player.runCommand("inputpermission set @s jump enabled")
    };
    if(number2 == 3){
        player.sendMessage("回復キット <Level 3>を使用…");
        player.runCommand("clear @s cw:kaihuku_kit3 0 1")
        player.runCommand("inputpermission set @s jump disabled")
        await system.waitTicks(60)
        heal(entity,40)
        player.runCommand("inputpermission set @s jump enabled")
    }
}
//スマホ使用時
world.afterEvents.itemUse.subscribe((event) => {
    const player = event.source;
    const itemId = event.itemStack.typeId;
    const playerId = event.source.Id;
    if (itemId.includes("kaihuku_kit")){
    if (cooldowns.has(playerId)) {
    player.sendMessage("§cまだ使用できません！");
    return;
  }else{
    if (itemId === "cw:kaihuku_kit1") {
        kaihuku(player,1)
    };
    if (itemId === "cw:kaihuku_kit2") {
        kaihuku(player,2)
    };
    if (itemId === "cw:kaihuku_kit3") {
        kaihuku(player,3)
    }}}
    cooldowns.set(playerId, true);
    system.runTimeout(() => {
    cooldowns.delete(playerId);
  }, 30); // 100tick = 5秒
});