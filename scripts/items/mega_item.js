import { world, system, EquipmentSlot, EntityComponentTypes, ItemStack } from "@minecraft/server";
import { ActionFormData } from "@minecraft/server-ui";
import { Lore } from "../utils/Lore.js";

const ITEM_CATEGORIES = {
  "原木・木材系": {
    icon: "textures/blocks/log_oak_top",
    items: [
      { id: "minecraft:oak_log", name: "オークの原木", icon: "textures/blocks/log_oak_top" },
      { id: "minecraft:oak_planks", name: "オークの木材", icon: "textures/blocks/planks_oak" },
      { id: "minecraft:birch_log", name: "白樺の原木", icon: "textures/blocks/log_birch" },
      { id: "minecraft:birch_planks", name: "白樺の木材", icon: "textures/blocks/planks_birch" },
      { id: "minecraft:spruce_log", name: "トウヒの原木", icon: "textures/blocks/log_spruce" },
      { id: "minecraft:spruce_planks", name: "トウヒの木材", icon: "textures/blocks/planks_spruce" },
      { id: "minecraft:jungle_log", name: "ジャングルの原木", icon: "textures/blocks/log_jungle" },
      { id: "minecraft:jungle_planks", name: "ジャングルの木材", icon: "textures/blocks/planks_jungle" },
      { id: "minecraft:acacia_log", name: "アカシアの原木", icon: "textures/blocks/log_acacia" },
      { id: "minecraft:acacia_planks", name: "アカシアの木材", icon: "textures/blocks/planks_acacia" },
      { id: "minecraft:dark_oak_log", name: "ダークオークの原木", icon: "textures/blocks/log_big_oak" },
      { id: "minecraft:dark_oak_planks", name: "ダークオークの木材", icon: "textures/blocks/planks_big_oak" },
      { id: "minecraft:cherry_log", name: "桜の原木", icon: "textures/blocks/cherry_log_side" },
      { id: "minecraft:cherry_planks", name: "桜の木材", icon: "textures/blocks/cherry_planks" },
      { id: "minecraft:mangrove_log", name: "マングローブの原木", icon: "textures/blocks/mangrove_log_side" },
      { id: "minecraft:mangrove_planks", name: "マングローブの木材", icon: "textures/blocks/mangrove_planks" }
    ]
  },
  "石・土系": {
    icon: "textures/blocks/stone",
    items: [
      { id: "minecraft:dirt", name: "土", icon: "textures/blocks/dirt" },
      { id: "minecraft:stone", name: "石", icon: "textures/blocks/stone" },
      { id: "minecraft:cobblestone", name: "丸石", icon: "textures/blocks/cobblestone" },
      { id: "minecraft:andesite", name: "安山岩", icon: "textures/blocks/stone_andesite" },
      { id: "minecraft:diorite", name: "閃緑岩", icon: "textures/blocks/stone_diorite" },
      { id: "minecraft:granite", name: "花崗岩", icon: "textures/blocks/stone_granite" },
      { id: "minecraft:gravel", name: "砂利", icon: "textures/blocks/gravel" },
      { id: "minecraft:sand", name: "砂", icon: "textures/blocks/sand" },
      { id: "minecraft:sandstone", name: "砂岩", icon: "textures/blocks/sandstone_normal" },
      { id: "minecraft:snow_block", name: "雪ブロック", icon: "textures/blocks/snow" },
      { id: "minecraft:glass", name: "ガラス", icon: "textures/blocks/glass" },
      { id: "minecraft:obsidian", name: "黒曜石", icon: "textures/blocks/obsidian" },
      { id: "minecraft:netherrack", name: "ネザーラック", icon: "textures/blocks/netherrack" },
      { id: "minecraft:end_stone", name: "エンドストーン", icon: "textures/blocks/end_stone" }
    ]
  },
  "鉱石・素材系": {
    icon: "textures/items/diamond",
    items: [
      { id: "minecraft:coal", name: "石炭", icon: "textures/items/coal" },
      { id: "minecraft:raw_iron", name: "鉄の原石", icon: "textures/items/raw_iron" },
      { id: "minecraft:iron_ingot", name: "鉄インゴット", icon: "textures/items/iron_ingot" },
      { id: "minecraft:raw_gold", name: "金の原石", icon: "textures/items/raw_gold" },
      { id: "minecraft:gold_ingot", name: "金インゴット", icon: "textures/items/gold_ingot" },
      { id: "minecraft:raw_copper", name: "銅の原石", icon: "textures/items/raw_copper" },
      { id: "minecraft:copper_ingot", name: "銅インゴット", icon: "textures/items/copper_ingot" },
      { id: "minecraft:redstone", name: "レッドストーン", icon: "textures/items/redstone_dust" },
      { id: "minecraft:diamond", name: "ダイヤモンド", icon: "textures/items/diamond" },
      { id: "minecraft:emerald", name: "エメラルド", icon: "textures/items/emerald" }
    ]
  },
  "その他": {
    icon: "textures/items/wheat",
    items: [
      { id: "minecraft:wheat", name: "小麦", icon: "textures/items/wheat" },
      { id: "minecraft:firework_rocket", name: "ロケット花火", icon: "textures/items/fireworks" }
    ]
  }
};

const ALL_ITEMS = Object.values(ITEM_CATEGORIES).flatMap(category => category.items);

const MAX_STACKS = 9;
const STACK_SIZE = 64;

// アイテムIDのエンコード/デコード (":"をLoreのキー区切りと衝突しないよう変換)
function encodeItemId(id) {
  return id.replace(":", "__");
}
function decodeItemId(encoded) {
  return encoded.replace("__", ":");
}

// 右クリックイベント
world.afterEvents.itemUse.subscribe((event) => {
  const player = event.source;
  const itemStack = event.itemStack;

  if (itemStack.typeId !== "cw:mega_item") return;

  const isSneaking = player.isSneaking;
  const slot = player.selectedSlotIndex;
  const storedData = getStoredData(player, slot);

  if (isSneaking) {
    if (storedData.count === 0) {
      showCategorySelectionUI(player, itemStack);
    } else {
      withdrawAllItems(player, itemStack, storedData);
    }
  } else {
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
  const slot = player.selectedSlotIndex;

  const equippable = player.getComponent(EntityComponentTypes.Equippable);
  if (!equippable) return;

  const mainhandItem = equippable.getEquipment(EquipmentSlot.Mainhand);
  if (!mainhandItem || mainhandItem.typeId !== "cw:mega_item") return;

  const storedData = getStoredData(player, slot);
  const isSneaking = player.isSneaking;

  if (storedData.count > 0) {
    if (isSneaking) {
      withdrawSingleItem(player, mainhandItem, storedData);
    } else {
      withdrawItems(player, mainhandItem, storedData);
    }
  }
});

/**
 * カテゴリ選択UIを表示
 */
async function showCategorySelectionUI(player, itemStack) {
  const form = new ActionFormData()
    .title("§l§6カテゴリを選択")
    .body("§7どのカテゴリから選びますか?");

  const categoryNames = Object.keys(ITEM_CATEGORIES);

  categoryNames.forEach(categoryName => {
    const category = ITEM_CATEGORIES[categoryName];
    form.button(categoryName, category.icon);
  });

  try {
    const response = await form.show(player);
    if (response.canceled) return;

    const selectedCategory = categoryNames[response.selection];
    showItemSelectionUI(player, itemStack, selectedCategory);

  } catch (error) {
    console.error("カテゴリ選択UI表示エラー:", error);
  }
}

/**
 * アイテム選択UIを表示
 */
async function showItemSelectionUI(player, itemStack, categoryName) {
  const category = ITEM_CATEGORIES[categoryName];
  const items = category.items;

  const form = new ActionFormData()
    .title(`§l§6${categoryName}`)
    .body("§7どのアイテムを収納しますか?");

  items.forEach(item => {
    form.button(item.name, item.icon);
  });

  try {
    const response = await form.show(player);

    if (response.canceled) {
      showCategorySelectionUI(player, itemStack);
      return;
    }

    const selectedItem = items[response.selection];
    const slot = player.selectedSlotIndex;

    // ":" を "__" に変換して保存
    Lore.setLore(player, slot, "item", encodeItemId(selectedItem.id));
    Lore.setLore(player, slot, "count", "0");
    updateMegaItem(player, slot, {
      selectedItem: selectedItem.id,
      selectedName: selectedItem.name,
      count: 0
    });

    player.sendMessage(`§aセレクトアイテムを §e${selectedItem.name} §aに設定しました`);

  } catch (error) {
    console.error("アイテム選択UI表示エラー:", error);
  }
}

/**
 * インベントリのセレクトアイテムを全て収納
 */
function storeAllItems(player, itemStack, storedData) {
  const inventory = player.getComponent(EntityComponentTypes.Inventory);
  if (!inventory || !inventory.container) return;

  const maxCapacity = MAX_STACKS * STACK_SIZE;
  let totalStored = 0;

  for (let i = 0; i < inventory.container.size; i++) {
    const slot = inventory.container.getItem(i);
    if (!slot || slot.typeId !== storedData.selectedItem) continue;

    const canStore = maxCapacity - storedData.count;
    if (canStore <= 0) break;

    const storeAmount = Math.min(slot.amount, canStore - totalStored);
    totalStored += storeAmount;

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
    const slot = player.selectedSlotIndex;
    Lore.setLore(player, slot, "count", storedData.count.toString());
    updateMegaItem(player, slot, storedData);
    player.sendMessage(`§a${totalStored}個の §e${storedData.selectedName} §aを収納しました (合計: ${storedData.count})`);
  } else {
    player.sendMessage("§c収納できるアイテムがインベントリにありません");
  }
}

/**
 * 全て出す
 */
function withdrawAllItems(player, itemStack, storedData) {
  const inventory = player.getComponent(EntityComponentTypes.Inventory);
  if (!inventory || !inventory.container) return;

  let remainingItems = storedData.count;
  let totalWithdrawn = 0;
  let droppedItems = 0;

  while (remainingItems > 0) {
    const withdrawAmount = Math.min(64, remainingItems);
    const newItem = new ItemStack(storedData.selectedItem, withdrawAmount);
    const remainingItem = inventory.container.addItem(newItem);

    if (remainingItem) {
      const actualAdded = withdrawAmount - remainingItem.amount;
      totalWithdrawn += actualAdded;
      player.dimension.spawnItem(remainingItem, player.location);
      droppedItems += remainingItem.amount;
      remainingItems -= withdrawAmount;
    } else {
      totalWithdrawn += withdrawAmount;
      remainingItems -= withdrawAmount;
    }
  }

  storedData.count = 0;
  const slot = player.selectedSlotIndex;
  Lore.setLore(player, slot, "count", "0");
  updateMegaItem(player, slot, storedData);

  if (droppedItems > 0) {
    player.sendMessage(`§a${totalWithdrawn + droppedItems}個の §e${storedData.selectedName} §aを取り出しました (残り: 0)`);
    player.sendMessage(`§e${droppedItems}個はインベントリが満杯のためドロップしました`);
  } else {
    player.sendMessage(`§a${totalWithdrawn}個の §e${storedData.selectedName} §aを取り出しました (残り: 0)`);
  }
}

/**
 * 64個ずつ出す
 */
function withdrawItems(player, itemStack, storedData) {
  const inventory = player.getComponent(EntityComponentTypes.Inventory);
  if (!inventory || !inventory.container) return;

  const withdrawAmount = Math.min(64, storedData.count);
  const newItem = new ItemStack(storedData.selectedItem, withdrawAmount);
  const remainingItem = inventory.container.addItem(newItem);

  if (remainingItem) {
    const actualWithdrawn = withdrawAmount - remainingItem.amount;
    if (actualWithdrawn > 0) {
      storedData.count -= actualWithdrawn;
      const slot = player.selectedSlotIndex;
      Lore.setLore(player, slot, "count", storedData.count.toString());
      updateMegaItem(player, slot, storedData);
      player.sendMessage(`§a${actualWithdrawn}個の §e${storedData.selectedName} §aを取り出しました (残り: ${storedData.count})`);
      player.sendMessage("§eインベントリが満杯です");
    } else {
      player.sendMessage("§cインベントリが満杯です");
    }
  } else {
    storedData.count -= withdrawAmount;
    const slot = player.selectedSlotIndex;
    Lore.setLore(player, slot, "count", storedData.count.toString());
    updateMegaItem(player, slot, storedData);
    player.sendMessage(`§a${withdrawAmount}個の §e${storedData.selectedName} §aを取り出しました (残り: ${storedData.count})`);
  }
}

/**
 * 1個だけ出す
 */
function withdrawSingleItem(player, itemStack, storedData) {
  const inventory = player.getComponent(EntityComponentTypes.Inventory);
  if (!inventory || !inventory.container) return;

  const newItem = new ItemStack(storedData.selectedItem, 1);
  const remainingItem = inventory.container.addItem(newItem);

  if (!remainingItem) {
    storedData.count -= 1;
    const slot = player.selectedSlotIndex;
    Lore.setLore(player, slot, "count", storedData.count.toString());
    updateMegaItem(player, slot, storedData);
    player.sendMessage(`§a1個の §e${storedData.selectedName} §aを取り出しました (残り: ${storedData.count})`);
  } else {
    player.sendMessage("§cインベントリが満杯です");
  }
}

/**
 * Loreから収納データを取得
 */
function getStoredData(player, slot) {
  const data = {
    selectedItem: null,
    selectedName: null,
    count: 0
  };

  const itemData = Lore.getLore(player, slot, "item");
  const countData = Lore.getLore(player, slot, "count");

  if (itemData) {
    // "__" を ":" に戻してIDを復元
    data.selectedItem = decodeItemId(itemData);
    const configItem = ALL_ITEMS.find(item => item.id === data.selectedItem);
    if (configItem) {
      data.selectedName = configItem.name;
    }
  }

  if (countData) {
    data.count = parseInt(countData);
  }

  return data;
}

/**
 * mega_itemを更新
 */
function updateMegaItem(player, slot, storedData) {
  const container = player.getComponent("inventory").container;
  const item = container.getItem(slot);
  if (!item) return;

  const loreLines = item.getLore();

  // § で始まらない行のみ残す (データ行は § を含まない)
  const dataLore = loreLines.filter(l => !l.startsWith("§"));

  const displayLore = [];
  if (storedData.selectedItem) {
    displayLore.push(`§6収納アイテム: ${storedData.selectedName}`);
    displayLore.push(`§6収納数: ${storedData.count}個 §7/ ${MAX_STACKS * STACK_SIZE}個`);
    displayLore.push(`§7右クリック: 全て収納`);
    displayLore.push(`§7Shift+右クリック: 全て取り出す`);
    displayLore.push(`§7左クリック: 64個取り出す`);
    displayLore.push(`§7Shift+左クリック: 1個取り出す`);
  } else {
    displayLore.push(`§7Shift+右クリックでアイテムを選択`);
  }

  item.setLore([...dataLore, ...displayLore]);
  container.setItem(slot, item);
}