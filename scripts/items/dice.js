import { world, system } from "@minecraft/server";

world.afterEvents.itemUse.subscribe((event) => {
    const { source: player, itemStack: item } = event;

    if (item.typeId == "cw:dice"){
    const spawnPos = player.location;
    if (player.isSneaking){
        const n = 1;
    }else{
        const n = 2;
    }
    player.dimension.spawnEntity("cw:dice", spawnPos,);
    player.runCommand(`clear @s cw:dice 0 1`)
    const diceRoll = Math.floor(Math.random() * 6) + 1;
    const dices = player.dimension.getEntities({
            location: spawnPos,
            maxDistance: 0.3,
            type: "cw:dice"
        });
        system.runTimeout(() => {
        for (const entity of dices){
        if(!entity.hasTag(`diceRolled`)){
        entity.playAnimation(`animation.dice.roll${diceRoll}`);
        entity.addTag(`diceRolled`);
        }}
    }, 2);
    system.runTimeout(() => {
        player.playSound("block.bell.hit",{
            location: spawnPos,
        })
        if (n == 2){
            const players = player.dimension.getEntities({
                location: spawnPos,
                maxDistance: 40,
                type: "player"
            });
            for (const p of players){
                p.sendMessage(`${player.name} rolled a ${diceRoll}!`);
            }};
    }, 30);
}
})

world.afterEvents.entitySpawn.subscribe((event) => {
    const entity = event.entity;
    if (entity.typeId != "cw:dice") return;
    system.runTimeout(() => {
        entity.teleport({x: entity.location.x, y: -100, z: entity.location.z});
    },400);
});