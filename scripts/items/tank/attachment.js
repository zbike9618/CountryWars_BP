import * as server from "@minecraft/server";
import { ActionFormData, ModalFormData } from "@minecraft/server-ui";

const { world } = server;

world.afterEvents.itemUse.subscribe((ev) => {
    const { itemStack, source: player } = ev;

    // レンチを使用してスニークしている場合のみ起動
    if (itemStack.typeId !== "cw:wrench" || !player.isSneaking) return;

    // 視線の先にあるタンクを取得
    const result = player.getEntitiesFromViewDirection({ maxDistance: 10 });
    const tank = result.find(r => r.entity.typeId === "cw:tank")?.entity;

    if (tank) {
        showTankConfigMenu(player, tank);
    }
});

/**
 * タンクのアタッチメント設定メニューを表示
 * @param {server.Player} player 
 * @param {server.Entity} tank 
 */
async function showTankConfigMenu(player, tank) {
    const form = new ActionFormData();
    form.title({ translate: "cw.tank_config.title" });

    // 現在のデータを取得 (デフォルト: unknown#unknown#unknown)
    const tankDataRaw = tank.getDynamicProperty("tankData") ?? "unknown#unknown#unknown";
    const attachmentIds = tankDataRaw.split("#");

    // 各スロットの状態をボタンとして表示
    for (const id of attachmentIds) {
        if (id === "unknown") {
            form.button({ translate: "cw.tank_config.noset" });
        } else {
            form.button({ translate: `item.${id}` });
        }
    }

    const { canceled, selection: slotIndex } = await form.show(player);
    if (canceled) return;

    showAttachmentSelection(player, tank, slotIndex);
}

/**
 * アタッチメント選択画面を表示
 * @param {server.Player} player 
 * @param {server.Entity} tank 
 * @param {number} attachmentSlotIndex 
 */
async function showAttachmentSelection(player, tank, attachmentSlotIndex) {
    const inventory = player.getComponent("inventory");
    if (!inventory?.container) return;

    const container = inventory.container;
    const availableTemplates = [];

    // インベントリからテンプレートアイテムを検索
    for (let i = 0; i < container.size; i++) {
        const item = container.getItem(i);
        if (item?.typeId.endsWith("_tank_template")) {
            availableTemplates.push({ typeId: item.typeId, slot: i });
        }
    }

    const form = new ModalFormData();
    const options = ["cw.tank_config.noset", ...availableTemplates.map(t => `item.${t.typeId}`)];

    form.title({ translate: "cw.tank_config.title" });
    form.dropdown({ translate: "cw.tank_config.dropdown" }, options);

    const { canceled, formValues } = await form.show(player);
    if (canceled) return;

    const selectionIndex = formValues[0];
    const tankDataRaw = tank.getDynamicProperty("tankData") ?? "unknown#unknown#unknown";
    const attachmentIds = tankDataRaw.split("#");

    // 現在装着されているアイテムを返却
    const currentId = attachmentIds[attachmentSlotIndex];
    if (currentId !== "unknown") {
        container.addItem(new server.ItemStack(currentId, 1));
    }

    // 新しいアイテムを装着
    if (selectionIndex === 0) {
        // 解除
        attachmentIds[attachmentSlotIndex] = "unknown";
    } else {
        // 装着
        const selected = availableTemplates[selectionIndex - 1];
        const templateItem = container.getItem(selected.slot);

        if (templateItem) {
            attachmentIds[attachmentSlotIndex] = selected.typeId;
            if (templateItem.amount > 1) {
                templateItem.amount -= 1;
                container.setItem(selected.slot, templateItem);
            } else {
                container.setItem(selected.slot, undefined);
            }
        }
    }

    // データを保存
    tank.setDynamicProperty("tankData", attachmentIds.join("#"));
    const attachment = getAttachment(tank)
    tank.setProperty("cw:health_type", attachment.shield || 0)
    tank.setProperty("cw:fast", attachment.fast || 0)
    tank.setProperty("cw:fast_underwater", attachment.fast_underwater || 0)
    showTankConfigMenu(player, tank)
}


export function getAttachment(tank) {
    const tankDataRaw = tank.getDynamicProperty("tankData") ?? "unknown#unknown#unknown";
    const attachmentIds = tankDataRaw.split("#").map(id => id.replace("cw:", "").replace("_tank_template", ""));

    const returnData = {

    }
    for (const id of attachmentIds) {
        if (id === "unknown") continue;
        Object.assign(returnData, { [id]: (returnData[id] || 0) + 1 })
    }
    return returnData
}