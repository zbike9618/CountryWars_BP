import { world, system, EquipmentSlot, EntityComponentTypes, ItemStack } from "@minecraft/server";
import { ActionFormData } from "@minecraft/server-ui";

// コンフィグ: 収納可能なアイテムリスト
const ALLOWED_ITEMS = [
{ id: "minecraft:dirt", name: "cw.item.dirt" },
{ id: "minecraft:stone", name: "cw.item.stone" },
{ id: "minecraft:cobblestone", name: "cw.item.cobblestone" },
{ id: "minecraft:andesite", name: "cw.item.andesite" },
{ id: "minecraft:diorite", name: "cw.item.diorite" },
{ id: "minecraft:granite", name: "cw.item.granite" },
{ id: "minecraft:gravel", name: "cw.item.gravel" },
{ id: "minecraft:sand", name: "cw.item.sand" },
{ id: "minecraft:snow_block", name: "cw.item.snow" },
{ id: "minecraft:glass", name: "cw.item.glass" },
{ id: "minecraft:obsidian", name: "cw.item.obsidian" },

// ── 木材・原木系 ──
{ id: "minecraft:oak_log", name: "cw.item.oak_log" },
{ id: "minecraft:oak_planks", name: "cw.item.oak_planks" },

{ id: "minecraft:birch_log", name: "cw.item.birch_log" },
{ id: "minecraft:birch_planks", name: "cw.item.birch_planks" },

{ id: "minecraft:spruce_log", name: "cw.item.spruce_log" },
{ id: "minecraft:spruce_planks", name: "cw.item.spruce_planks" },

{ id: "minecraft:jungle_log", name: "cw.item.jungle_log" },
{ id: "minecraft:jungle_planks", name: "cw.item.jungle_planks" },

{ id: "minecraft:acacia_log", name: "cw.item.acacia_log" },
{ id: "minecraft:acacia_planks", name: "cw.item.acacia_planks" },

{ id: "minecraft:dark_oak_log", name: "cw.item.dark_oak_log" },
{ id: "minecraft:dark_oak_planks", name: "cw.item.dark_oak_planks" },

{ id: "minecraft:cherry_log", name: "cw.item.cherry_log" },
{ id: "minecraft:cherry_planks", name: "cw.item.cherry_planks" },

{ id: "minecraft:mangrove_log", name: "cw.item.mangrove_log" },
{ id: "minecraft:mangrove_planks", name: "cw.item.mangrove_planks" },

// ── 鉱石・素材 ──
{ id: "minecraft:coal", name: "cw.item.coal" },
{ id: "minecraft:raw_iron", name: "cw.item.raw_iron" },
{ id: "minecraft:iron_ingot", name: "cw.item.iron_ingot" },
{ id: "minecraft:raw_gold", name: "cw.item.raw_gold" },
{ id: "minecraft:gold_ingot", name: "cw.item.gold_ingot" },
{ id: "minecraft:raw_copper", name: "cw.item.raw_copper" },
{ id: "minecraft:copper_ingot", name: "cw.item.copper_ingot" },
{ id: "minecraft:redstone", name: "cw.item.redstone" },
{ id: "minecraft:diamond", name: "cw.item.diamond" },
{ id: "minecraft:emerald", name: "cw.item.emerald" },

// ── 異世界ブロック ──
{ id: "minecraft:netherrack", name: "cw.item.netherrack" },
{ id: "minecraft:end_stone", name: "cw.item.end_stone" },

// ── 農業・消耗品 ──
{ id: "minecraft:wheat", name: "cw.item.wheat" },
{ id: "minecraft:firework_rocket", name: "cw.item.firework_rocket" }

// ここに追加可能
];

const MAX_STACKS = 9; // 最大27スタック
const STACK_SIZE = 64; // 1スタックのサイズ

// 右クリックイベント
world.afterEvents.itemUse.subscribe((event) => {
const player = event.source;
const itemStack = event.itemStack;

if (itemStack.typeId !== "cw:mega_item") return;

const isSneaking = player.isSneaking;
const storedData = getStoredData(itemStack);

if (isSneaking) {
// スニーク + 右クリック
if (storedData.count === 0) {
// 収納アイテムが0の時: アイテム選択UI表示
showItemSelectionUI(player, itemStack);
} else {
// 収納アイテムがある時: 全て取り出す
withdrawAllItems(player, itemStack, storedData);
}
} else {
// 通常右クリック: インベントリのセレクトアイテムを全て収納
if (!storedData.selectedItem) {
player.sendMessage("§cセレクトアイテムが選択されていません");
return;
}
storeAllItems(player, itemStack, storedData);
}
});

// 左クリックイベント
world.afterEvents.playerSwingStart.subscribe((event) => {
const player = event.player;
const itemStack = event.heldItemStack;

// アイテムを持っていないか、mega_itemでない場合はスキップ
if (!itemStack || itemStack.typeId !== "cw:mega_item") return;

// 実際に手持ちにあるか確認(ドロップ時の誤動作を防ぐ)
const equippable = player.getComponent(EntityComponentTypes.Equippable);
if (!equippable) return;

const mainhandItem = equippable.getEquipment(EquipmentSlot.Mainhand);
if (!mainhandItem || mainhandItem.typeId !== "cw:mega_item") return;

const storedData = getStoredData(mainhandItem);
const isSneaking = player.isSneaking;

if (storedData.count > 0) {
if (isSneaking) {
// Shift + 左クリック: 1個だけ出す
withdrawSingleItem(player, mainhandItem, storedData);
} else {
// 左クリック: 64個出す
withdrawItems(player, mainhandItem, storedData);
}
}
});

/**

- アイテム選択UIを表示
  */
  async function showItemSelectionUI(player, itemStack) {
  const form = new ActionFormData()
  .title("§l収納アイテムを選択")
  .body("どのアイテムを収納しますか?");

// コンフィグからアイテムリストを追加
ALLOWED_ITEMS.forEach(item => {
form.button(item.name);
});

try {
const response = await form.show(player);


if (response.canceled) return;

const selectedIndex = response.selection;
const selectedItem = ALLOWED_ITEMS[selectedIndex];

// セレクトアイテムを設定
updateMegaItem(player, itemStack, {
  selectedItem: selectedItem.id,
  selectedName: selectedItem.name,
  count: 0
});

player.sendMessage(`§aセレクトアイテムを §e${selectedItem.name} §aに設定しました`);


} catch (error) {
console.error("UI表示エラー:", error);
}
}

/**

- インベントリのセレクトアイテムを全て収納
  */
  function storeAllItems(player, itemStack, storedData) {
  const inventory = player.getComponent(EntityComponentTypes.Inventory);
  if (!inventory || !inventory.container) return;

const maxCapacity = MAX_STACKS * STACK_SIZE;
let totalStored = 0;

// インベントリをスキャンしてセレクトアイテムを収集
for (let i = 0; i < inventory.container.size; i++) {
const slot = inventory.container.getItem(i);
if (!slot || slot.typeId !== storedData.selectedItem) continue;


const canStore = maxCapacity - storedData.count;
if (canStore <= 0) break;

const storeAmount = Math.min(slot.amount, canStore - totalStored);
totalStored += storeAmount;

// アイテムを削除または減らす
if (storeAmount >= slot.amount) {
  inventory.container.setItem(i, undefined);
} else {
  slot.amount -= storeAmount;
  inventory.container.setItem(i, slot);
}

if (totalStored >= canStore) break;


}

if (totalStored > 0) {
storedData.count += totalStored;
updateMegaItem(player, itemStack, storedData);
player.sendMessage(`§a${totalStored}個の ${storedData.selectedName} を収納しました (合計: ${storedData.count})`);
} else {
player.sendMessage("§c収納できるアイテムがインベントリにありません");
}
}

/**

- 全て出す
  */
  function withdrawAllItems(player, itemStack, storedData) {
  const inventory = player.getComponent(EntityComponentTypes.Inventory);
  if (!inventory || !inventory.container) return;

let remainingItems = storedData.count;
let totalWithdrawn = 0;

// 64個ずつスタックを作成してインベントリに追加
while (remainingItems > 0) {
const withdrawAmount = Math.min(64, remainingItems);
const newItem = new ItemStack(storedData.selectedItem, withdrawAmount);


const remainingItem = inventory.container.addItem(newItem);

if (remainingItem) {
  // インベントリが満杯
  const actualWithdrawn = withdrawAmount - remainingItem.amount;
  totalWithdrawn += actualWithdrawn;
  remainingItems -= actualWithdrawn;
  break;
} else {
  totalWithdrawn += withdrawAmount;
  remainingItems -= withdrawAmount;
}


}

if (totalWithdrawn > 0) {
storedData.count -= totalWithdrawn;
updateMegaItem(player, itemStack, storedData);
player.sendMessage(`§a${totalWithdrawn}個の ${storedData.selectedName} を取り出しました (残り: ${storedData.count})`);


if (remainingItems > 0) {
  player.sendMessage("§eインベントリが満杯です");
}


} else {
player.sendMessage("§cインベントリが満杯です");
}
}

/**

- 64個ずつ出す
  */
  function withdrawItems(player, itemStack, storedData) {
  const inventory = player.getComponent(EntityComponentTypes.Inventory);
  if (!inventory || !inventory.container) return;

const withdrawAmount = Math.min(64, storedData.count);

// 新しいアイテムスタックを作成
const newItem = new ItemStack(storedData.selectedItem, withdrawAmount);

// インベントリに追加を試みる
const remainingItem = inventory.container.addItem(newItem);

if (remainingItem) {
// インベントリが満杯の場合
const actualWithdrawn = withdrawAmount - remainingItem.amount;
if (actualWithdrawn > 0) {
storedData.count -= actualWithdrawn;
updateMegaItem(player, itemStack, storedData);
player.sendMessage(`§a${actualWithdrawn}個の ${storedData.selectedName} を取り出しました (残り: ${storedData.count})`);
player.sendMessage("§eインベントリが満杯です");
} else {
player.sendMessage("§cインベントリが満杯です");
}
} else {
storedData.count -= withdrawAmount;
updateMegaItem(player, itemStack, storedData);
player.sendMessage(`§a${withdrawAmount}個の ${storedData.selectedName} を取り出しました (残り: ${storedData.count})`);
}
}

/**

- 1個だけ出す
  */
  function withdrawSingleItem(player, itemStack, storedData) {
  const inventory = player.getComponent(EntityComponentTypes.Inventory);
  if (!inventory || !inventory.container) return;

// 1個のアイテムスタックを作成
const newItem = new ItemStack(storedData.selectedItem, 1);

// インベントリに追加を試みる
const remainingItem = inventory.container.addItem(newItem);

if (!remainingItem) {
storedData.count -= 1;
updateMegaItem(player, itemStack, storedData);
player.sendMessage(`§a1個の ${storedData.selectedName} を取り出しました (残り: ${storedData.count})`);
} else {
player.sendMessage("§cインベントリが満杯です");
}
}

/**

- Loreから収納データを取得
  */
  function getStoredData(itemStack) {
  const lore = itemStack.getLore();

const data = {
selectedItem: null,
selectedName: null,
count: 0
};

if (lore.length > 0) {
// "収納アイテム: xxx" の形式
const itemMatch = lore[0].match(/収納アイテム: (.+)/);
if (itemMatch) {
data.selectedName = itemMatch[1];


  // コンフィグから該当アイテムのIDを取得
  const configItem = ALLOWED_ITEMS.find(item => item.name === data.selectedName);
  if (configItem) {
    data.selectedItem = configItem.id;
  }
}


}

if (lore.length > 1) {
// "収納数: xxx個" の形式
const countMatch = lore[1].match(/収納数: (\d+)個/);
if (countMatch) {
data.count = parseInt(countMatch[1]);
}
}

return data;
}

/**

- mega_itemを更新
  */
  function updateMegaItem(player, oldItemStack, storedData) {
  const inventory = player.getComponent(EntityComponentTypes.Inventory);
  if (!inventory || !inventory.container) return;

const selectedSlot = player.selectedSlotIndex;
const newItemStack = oldItemStack.clone();

// Loreを更新
const loreLines = [];

if (storedData.selectedItem) {
loreLines.push(`§6収納アイテム: ${storedData.selectedName}`);
loreLines.push(`§6収納数: ${storedData.count}個 §7/ ${MAX_STACKS * STACK_SIZE}個`);
loreLines.push(`§7右クリック: 全て収納`);
loreLines.push(`§7Shift+右クリック: 全て取り出す`);
loreLines.push(`§7左クリック: 64個取り出す`);
loreLines.push(`§7Shift+左クリック: 1個取り出す`);
} else {
loreLines.push(`§7Shift+右クリックでアイテムを選択`);
}

newItemStack.setLore(loreLines);
inventory.container.setItem(selectedSlot, newItemStack);
}