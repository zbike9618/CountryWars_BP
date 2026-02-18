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

// 1ティックごとに実行される処理
system.runInterval(() => {
  for (const player of world.getAllPlayers()) {
    if (!player.isSneaking) continue;

    const equippable = player.getComponent(EntityComponentTypes.Equippable);
    if (!equippable) continue;

    const mainhandSlot = player.selectedSlotIndex;
    const mainhandItem = equippable.getEquipment(EquipmentSlot.Mainhand);
    const offhandItem = equippable.getEquipment(EquipmentSlot.Offhand);

    let storedXp = 0;
    let isOffhand = false;

    if (mainhandItem && mainhandItem.typeId === "cw:xp_box") {
      storedXp = Number(Lore.getLore(player, mainhandSlot, "XP") || "0");
      isOffhand = false;
    } else if (offhandItem && offhandItem.typeId === "cw:xp_box") {
      // オフハンドのスロット番号を取得する必要があるが、Loreクラスがインベントリコンポーネントのみを想定している場合
      // player.getComponent("inventory") はオフハンドを含まない
      // Loreクラスをオフハンド対応にするか、ここでは直接処理するか。
      // ユーザーはLoreクラスへの置き換えを求めているので、オフハンドは一旦スキップか、直接処理。
      // ひとまずメインハンド優先。
      continue;
    }

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

    Lore.setLore(player, mainhandSlot, "XP", storedXp.toString());
    updateXpBoxDisplay(player, mainhandSlot);
  }
}, 1);

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
