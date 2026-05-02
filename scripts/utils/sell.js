import * as ui from "@minecraft/server-ui";
import { ModalFormData } from "@minecraft/server-ui";
import { EntityComponentTypes } from "@minecraft/server";
import { Util } from "./util";
import { SellConfig } from "../config/sell_config";
import { ChestFormData } from "./chest_shop/chest-ui";
import { itemIdToPath } from "../config/texture_config";

export class Sell {
    static async showForm(player) {
        const inventory = player.getComponent(EntityComponentTypes.Inventory).container;
        const sellableItems = new Map();

        // インベントリから売れるアイテムを収集
        for (let i = 0; i < inventory.size; i++) {
            const item = inventory.getItem(i);
            if (!item) continue;

            const typeId = item.typeId;
            if (SellConfig.items[typeId] !== undefined) {
                const price = SellConfig.items[typeId];
                if (!sellableItems.has(typeId)) {
                    sellableItems.set(typeId, { count: item.amount, price: price });
                } else {
                    const data = sellableItems.get(typeId);
                    data.count += item.amount;
                }
            }
        }

        if (sellableItems.size === 0) {
            player.sendMessage("§c売却可能なアイテムを持っていません。§r");
            return;
        }

        const form = new ChestFormData("large");
        form.setTitle("売却 / Sell");

        const buttons = [];
        let index = 0;

        for (const [typeId, data] of sellableItems) {
            const total = Math.floor(data.count * data.price);
            const itemName = Util.langChangeItemName(typeId);
            const icon = itemIdToPath[typeId];

            form.setButton(index, {
                name: itemName,
                iconPath: icon,
                lore: [`§7所持: ${data.count}個§r`, `§e売却額: $${total}§r`],
                editedName: true
            });
            buttons.push({ typeId, count: data.count, total, slot: index });
            index++;
            if (index > 53) break;
        }

        form.show(player).then(response => {
            if (response.canceled || response.selection === undefined) return;
            
            const selected = buttons.find(b => b.slot === response.selection);
            if (selected) {
                this.showSellModal(player, selected, sellableItems.get(selected.typeId).price);
            }
        }).catch(e => {
            player.sendMessage("§cエラーが発生しました: " + e + "§r");
        });
    }

    static async showSellModal(player, selectedItem, pricePerItem) {
        const modal = new ModalFormData();
        modal.title("売却個数の選択");
        modal.slider("売却する個数", 1, selectedItem.count);
        modal.toggle("すべて売却する");

        modal.show(player).then(res => {
            if (res.canceled) return;
            const [sliderAmount, sellAll] = res.formValues;
            const sellAmount = sellAll ? selectedItem.count : sliderAmount;
            
            this.sellItem(player, selectedItem.typeId, sellAmount, pricePerItem);
        }).catch(e => {
            player.sendMessage("§cエラーが発生しました: " + e + "§r");
        });
    }

    static sellItem(player, typeId, amountToSell, pricePerItem) {
        const inventory = player.getComponent(EntityComponentTypes.Inventory).container;
        let remainingToRemove = amountToSell;
        let actualRemoved = 0;

        for (let i = 0; i < inventory.size; i++) {
            if (remainingToRemove <= 0) break;
            
            const item = inventory.getItem(i);
            if (item && item.typeId === typeId) {
                if (item.amount <= remainingToRemove) {
                    actualRemoved += item.amount;
                    remainingToRemove -= item.amount;
                    inventory.setItem(i, undefined);
                } else {
                    actualRemoved += remainingToRemove;
                    item.amount -= remainingToRemove;
                    inventory.setItem(i, item);
                    remainingToRemove = 0;
                }
            }
        }

        if (actualRemoved > 0) {
            const totalReward = Math.floor(actualRemoved * pricePerItem);
            Util.addMoney(player, totalReward);
            const itemName = Util.langChangeItemName(typeId);
            player.sendMessage({
                rawtext: [
                    { text: "§e" },
                    { translate: itemName },
                    { text: `§rを §a${actualRemoved}個§r 売却し、§e$${totalReward}§r 獲得しました。` }
                ]
            });
        } else {
            player.sendMessage("§cアイテムが見つかりませんでした。§r");
        }
    }
}
