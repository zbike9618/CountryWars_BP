import { world, system,} from "@minecraft/server";

system.runInterval(() => {
  const players = world.getPlayers();
  for (const player of players) {
    const equip = player.getComponent("minecraft:equippable");
    let power = 0;
    if (equip.getEquipment("Chest")?.typeId === "cw:fabric_chestplate") { power++ };
    if (equip.getEquipment("Legs")?.typeId === "cw:fabric_leg") { power++ };
    if (equip.getEquipment("Feet")?.typeId === "cw:fabric_boots") { power++ };
    if (equip.getEquipment("Head")?.typeId === "cw:fabric_helmet") { power++ };
    //player.sendMessage(`${power} ${speed}`);
    if (power > 0) {
      const speed = poewr -1
      player.addEffect("speed", 1, speed, false);
    }
  }
}, 10);