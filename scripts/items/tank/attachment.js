import * as server from "@minecraft/server";
import { ActionFormData, ModalFormData } from "@minecraft/server-ui";
import Config from "../../config/config.js";

const { world } = server;

/**
 * タンクのアタッチメント用デフォルトデータを動的に生成
 * 例: 5スロットなら "unknown#unknown#unknown#unknown#unknown"
 */
function getDefaultTankData() {
    return Array(Config.tankMaxSlots).fill("unknown").join("#");
}

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

    // 現在のデータを取得
    let tankDataRaw = tank.getDynamicProperty("tankData") ?? getDefaultTankData();
    let attachmentIds = tankDataRaw.split("#");

    // 設定されたスロット数に合わせて配列を調整
    if (attachmentIds.length < Config.tankMaxSlots) {
        while (attachmentIds.length < Config.tankMaxSlots) {
            attachmentIds.push("unknown");
        }
    } else if (attachmentIds.length > Config.tankMaxSlots) {
        // 設定が減った場合は、余ったアタッチメントを解除して返却する等のロジックが必要だが、
        // ここでは単純に配列を切り詰める（データのみ保持したままアクセス不可になる）
        attachmentIds = attachmentIds.slice(0, Config.tankMaxSlots);
    }

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
    const tankDataRaw = tank.getDynamicProperty("tankData") ?? getDefaultTankData();
    const attachmentIds = tankDataRaw.split("#");

    // 新しいアイテムを装着する場合の重複チェック
    if (selectionIndex !== 0) {
        const selectedId = availableTemplates[selectionIndex - 1].typeId;

        // 現在のスロット以外で、同じ種類がいくつ付いているかカウント
        let count = 0;
        for (let i = 0; i < attachmentIds.length; i++) {
            if (i === attachmentSlotIndex) continue;
            if (attachmentIds[i] === selectedId) count++;
        }

        if (count >= 3) {
            player.sendMessage(`§c同じ種類のアタッチメントは最大3個までです§r`);
            showTankConfigMenu(player, tank);
            return;
        }
    }

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

    // プロパティの更新
    updateTankProperties(tank);

    // メニューに戻る
    showTankConfigMenu(player, tank);
}

/**
 * タンクのエンティティプロパティをアタッチメントの状態に同期
 * @param {server.Entity} tank 
 */
function updateTankProperties(tank) {
    const attachment = getAttachment(tank);

    // shield, fast, fast_underwater などのカウントをプロパティに適用 (最大値は tank.json の定義に従う)
    tank.setProperty("cw:health_type", Math.min(attachment.shield || 0, 3));
    tank.setProperty("cw:fast", Math.min(attachment.fast || 0, 3));
    tank.setProperty("cw:fast_underwater", Math.min(attachment.fast_underwater || 0, 3));
}

/**
 * タンクのアタッチメント情報を集計
 * @param {server.Entity} tank 
 * @returns {Record<string, number>} { shield: 1, fast: 2, ... }
 */
export function getAttachment(tank) {
    const tankDataRaw = tank.getDynamicProperty("tankData") ?? getDefaultTankData();
    const attachmentIds = tankDataRaw.split("#").map(id => id.replace("cw:", "").replace("_tank_template", ""));

    const returnData = {};
    for (const id of attachmentIds) {
        if (id === "unknown") continue;
        returnData[id] = (returnData[id] || 0) + 1;
    }
    return returnData;
}