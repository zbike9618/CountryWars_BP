import { world, system, EquipmentSlot, EntityComponentTypes } from "@minecraft/server";
import { Lore } from "../utils/Lore.js";

// アイテムを右クリックしたときのイベント
world.afterEvents.itemUse.subscribe((event) => {
  const player = event.source;
  const itemStack = event.itemStack;

  if (itemStack.typeId !== "cw:xp_box") return;

  // 累計経験値を取得
  const totalXp = player.getTotalXp();

  // XPが0なら中断
  if (totalXp <= 0) {
    player.sendMessage("§cもうレベルがありません");
    return;
  }

  const slot = player.selectedSlotIndex;
  const storedXp = Number(Lore.getLore(player, slot, "XP") || "0");
  const newStoredXp = storedXp + totalXp;

  // 経験値を完全リセット
  player.resetLevel();

  Lore.setLore(player, slot, "XP", newStoredXp.toString());
  updateXpBoxDisplay(player, slot);

  player.sendMessage(`§a経験値を${totalXp}ポイント収納しました (合計: ${newStoredXp})`);
});

system.runInterval(() => {
  for (const player of world.getAllPlayers()) {
    if (!player.isSneaking) continue;

    const equippable = player.getComponent(EntityComponentTypes.Equippable);
    if (!equippable) continue;

    let item = null;
    let slotType = null;

    const mainhandItem = equippable.getEquipment(EquipmentSlot.Mainhand);
    const offhandItem = equippable.getEquipment(EquipmentSlot.Offhand);

    if (mainhandItem && mainhandItem.typeId === "cw:xp_box") {
      item = mainhandItem;
      slotType = EquipmentSlot.Mainhand;
    } else if (offhandItem && offhandItem.typeId === "cw:xp_box") {
      item = offhandItem;
      slotType = EquipmentSlot.Offhand;
    }

    if (!item) continue;

    let storedXp = Number(item.getLore()?.find(l => l.startsWith("XP:"))?.split(":")[1] || 0);
    if (storedXp <= 0) continue;

    if (storedXp >= 9) {
      storedXp -= 9;
      player.dimension.runCommand(
        `structure load xp_orb_10 ${Math.floor(player.location.x)} ${Math.floor(player.location.y)} ${Math.floor(player.location.z)}`
      );
    } else {
      storedXp -= 1;
      player.dimension.runCommand(
        `structure load xp_orb ${Math.floor(player.location.x)} ${Math.floor(player.location.y)} ${Math.floor(player.location.z)}`
      );
    }

    // Lore更新
    let lore = item.getLore() ?? [];
    const index = lore.findIndex(l => l.startsWith("XP:"));
    if (index !== -1) {
      lore[index] = `XP:${storedXp}`;
    } else {
      lore.push(`XP:${storedXp}`);
    }

    item.setLore(lore);

    // 装備スロットに書き戻す（←ここが超重要）
    equippable.setEquipment(slotType, item);
  }
}, 5);

/**
 * Loreの表示を整える (Loreクラスはデータを保持するだけなので、見た目を別途設定)
 */
function updateXpBoxDisplay(player, slot) {
  const inventory = player.getComponent("inventory");
  const item = inventory.container.getItem(slot);
  if (!item) return;

  let lore = item.getLore();
  const xpLineIdx = lore.findIndex(l => l.startsWith("XP:"));
  if (xpLineIdx !== -1) {
    const xpAmount = lore[xpLineIdx].split(":")[1];
    // 他のデコレーション用行を保持しつつ、表示用の行も更新？
    // ユーザーの意図としては、Loreクラスの形式そのものを使いたいのかもしれない。
    // シンプルに Loreクラスに任せる。
  }
}
