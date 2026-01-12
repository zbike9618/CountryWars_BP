import { world, system, EquipmentSlot, EntityComponentTypes } from "@minecraft/server";

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

const storedXp = getStoredXp(itemStack);
const newStoredXp = storedXp + totalXp;

// 経験値を完全リセット
player.resetLevel();

updateXpBox(player, itemStack, newStoredXp);

player.sendMessage(`§a経験値を${totalXp}ポイント収納しました (合計: ${newStoredXp})`);
});

// 1ティックごとに実行される処理
system.runInterval(() => {
for (const player of world.getAllPlayers()) {
// スニーク中かチェック
if (!player.isSneaking) continue;

const equippable = player.getComponent(EntityComponentTypes.Equippable);
if (!equippable) continue;

// メインハンドとオフハンドをチェック
const mainhandItem = equippable.getEquipment(EquipmentSlot.Mainhand);
const offhandItem = equippable.getEquipment(EquipmentSlot.Offhand);

let xpBoxItem = null;
let isOffhand = false;

// メインハンドにあるか確認
if (mainhandItem && mainhandItem.typeId === "cw:xp_box") {
  xpBoxItem = mainhandItem;
  isOffhand = false;
}
// オフハンドにあるか確認
else if (offhandItem && offhandItem.typeId === "cw:xp_box") {
  xpBoxItem = offhandItem;
  isOffhand = true;
}

// どちらにもない場合はスキップ
if (!xpBoxItem) continue;

// 収納されている経験値を取得
let storedXp = getStoredXp(xpBoxItem);

// 経験値が足りない場合は処理しない
if (storedXp <= 0) continue;

// 9ポイント以上なら xp_orb_10 をロード
if (storedXp >= 9) {
  storedXp -= 9;
  player.dimension.runCommand(
    `structure load xp_orb_10 ${Math.floor(player.location.x)} ${Math.floor(player.location.y)} ${Math.floor(player.location.z)}`
  );
} 
// 9未満なら xp_orb をロード
else {
  storedXp -= 1;
  player.dimension.runCommand(
    `structure load xp_orb ${Math.floor(player.location.x)} ${Math.floor(player.location.y)} ${Math.floor(player.location.z)}`
  );
}

// アイテムを更新(メインハンドかオフハンドか判定)
updateXpBoxHand(player, equippable, xpBoxItem, storedXp, isOffhand);

}
}, 1); // 1ティック = 1

/**

- アイテムのLoreから収納されている経験値を取得
  */
  function getStoredXp(itemStack) {
  const lore = itemStack.getLore();

// Loreの最初の行から経験値を抽出
if (lore.length > 0) {
const match = lore[0].match(/収納経験値: (\d+)/);
if (match) {
return parseInt(match[1]);
}
}

return 0; // 収納されていない場合は0
}

/**

- プレイヤーのインベントリ内のアイテムを更新(メインハンド用)
  */
  function updateXpBox(player, oldItemStack, newXp) {
  const inventory = player.getComponent(EntityComponentTypes.Inventory);
  if (!inventory || !inventory.container) return;

// 手持ちのアイテムスロットを探す
const selectedSlot = player.selectedSlotIndex;

// 新しいアイテムスタックを作成
const newItemStack = oldItemStack.clone();

// Loreを更新
const loreLines = [
`§6収納経験値: ${newXp}`,
`§7右クリックで経験値を収納`,
`§7スニークで経験値を放出`
];
newItemStack.setLore(loreLines);

// インベントリを更新
inventory.container.setItem(selectedSlot, newItemStack);
}

/**

- メインハンドまたはオフハンドのアイテムを更新
  */
  function updateXpBoxHand(player, equippable, oldItemStack, newXp, isOffhand) {
  // 新しいアイテムスタックを作成
  const newItemStack = oldItemStack.clone();

// Loreを更新
const loreLines = [
`§6収納経験値: ${newXp}`,
`§7右クリックで経験値を収納`,
`§7スニークで経験値を放出`
];
newItemStack.setLore(loreLines);

// メインハンドかオフハンドかで分岐
if (isOffhand) {
equippable.setEquipment(EquipmentSlot.Offhand, newItemStack);
} else {
equippable.setEquipment(EquipmentSlot.Mainhand, newItemStack);
}
}