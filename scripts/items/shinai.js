import { world, ItemStack } from "@minecraft/server";

world.afterEvents.itemUse.subscribe((event) => {
    const { source: player, itemStack: item } = event;

    if (!item.typeId.startsWith("cw:shinai")) return;

    const currentLevel = parseInt(item.typeId.replace("cw:shinai", ""));
    const nextLevel = (currentLevel % 5) + 1;

    const inventory = player.getComponent("inventory");
    inventory.container.setItem(
        player.selectedSlotIndex,
        new ItemStack(`cw:shinai${nextLevel}`, 1)
    );
    player.sendMessage(`Now ${nextLevel}`)
});
