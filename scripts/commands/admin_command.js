import { Util } from "../utils/util";
import { world, system } from "@minecraft/server";
import { Dypro } from "../utils/dypro";
import { Stock } from "../utils/stock";
const playerDatas = new Dypro("player");
const countryDatas = new Dypro("country");
// ===== 管理者用金銭操作コマンド =====
system.afterEvents.scriptEventReceive.subscribe(ev => {
    if (ev.id == "cw:setmoney") {
        let args = ev.message.split(" ");
        if (ev.sourceType == "Entity") {
            Util.setMoney(ev.sourceEntity, Number(args[0]));
            ev.sourceEntity.sendMessage({ translate: "cw.admin.setmoney", with: [ev.sourceEntity.name, args[0]] });
        }
    }
})
system.afterEvents.scriptEventReceive.subscribe(ev => {
    if (ev.id == "cw:addmoney") {
        let args = ev.message.split(" ");
        if (ev.sourceType == "Entity") {
            Util.addMoney(ev.sourceEntity, Number(args[0]));
            ev.sourceEntity.sendMessage({ translate: "cw.admin.addmoney", with: [ev.sourceEntity.name, args[0]] });
        }
    }
})
// タグリセット
system.afterEvents.scriptEventReceive.subscribe(ev => {
    if (ev.id == "cw:resetjob") {
        if (ev.sourceType == "Entity") {
            ev.sourceEntity.removeTag("job:0");
            ev.sourceEntity.removeTag("job:1");
            ev.sourceEntity.removeTag("job:2");
            ev.sourceEntity.removeTag("job:3");
            ev.sourceEntity.removeTag("job:4");
            ev.sourceEntity.removeTag("job:5");
            ev.sourceEntity.sendMessage({ translate: "cw.admin.resetjob", with: [ev.sourceEntity.name] });
        }
    }
    if (ev.id == "cw:test") {
        const player = ev.sourceEntity;
        player.dimension.getEntities({ type: "cw:tank" }).forEach(entity => {
            entity.setProperty("cw:health_type", 3);
            const comp = entity.getComponent("minecraft:health");
            comp.resetToMaxValue();
        })
    }
    if (ev.id == "cw:allreset") {
        world.clearDynamicProperties();
        for (const player of world.getAllPlayers()) {
            player.clearDynamicProperties();
            player.runCommand(`kick @s ${Data.kickMessages.allreset || "初期化のため\nもう一度入りなおしてください"}`);

        }
    }
    if (ev.id == "cw:initial") {
        const playerData = playerDatas.get(ev.sourceEntity.id);
        if (!playerData) {
            ev.sourceEntity?.clearDynamicProperties();
            ev.sourceEntity?.runCommand(`kick @s ${Data.kickMessages.initial || "初期化のため\nもう一度入りなおしてください"}`);
        } else {
            ev.sourceEntity?.sendMessage(`§cプレイヤーデータが破損していないため実行できません。`);
        }
    }
    if (ev.id == "cw:force_initial") {
        ev.sourceEntity?.clearDynamicProperties();
        ev.sourceEntity?.runCommand(`kick @s ${Data.kickMessages.initial || "初期化のため\nもう一度入りなおしてください"}`);
    }
});

// ===== 称号 (二つ名) 追加/設定/削除 scriptevent =====
function parseTitleArgs(message) {
    if (!message) return [];
    const regex = /[^\s"]+|"[^"]*"/g;
    const matches = message.match(regex) || [];
    return matches.map(m => m.replace(/^"|"$/g, ""));
}

function resolveTargetAndArgs(ev) {
    const rawArgs = parseTitleArgs(ev.message?.trim() || "");
    let targetPlayer = null;
    let remainingArgs = rawArgs;

    if (rawArgs.length > 0) {
        const potentialName = rawArgs[0];
        const found = world.getAllPlayers().find(p => p.name === potentialName);
        if (found) {
            targetPlayer = found;
            remainingArgs = rawArgs.slice(1);
        }
    }

    if (!targetPlayer) {
        if (ev.sourceType === "Entity" && ev.sourceEntity?.typeId === "minecraft:player") {
            targetPlayer = ev.sourceEntity;
        } else if (ev.sourceType === "Block" && ev.sourceBlock) {
            const blockLocation = ev.sourceBlock.location;
            const dimension = ev.sourceBlock.dimension;
            let closestDist = Infinity;
            for (const p of dimension.getPlayers()) {
                const dx = p.location.x - blockLocation.x;
                const dy = p.location.y - blockLocation.y;
                const dz = p.location.z - blockLocation.z;
                const dist = dx * dx + dy * dy + dz * dz;
                if (dist < closestDist) {
                    closestDist = dist;
                    targetPlayer = p;
                }
            }
        }
    }

    return { targetPlayer, remainingArgs };
}

system.afterEvents.scriptEventReceive.subscribe(ev => {
    const eventId = ev.id;
    if (
        eventId !== "cw:addtitle" && eventId !== "cw:addsecondname" && eventId !== "cw:givetitle" &&
        eventId !== "cw:removetitle" && eventId !== "cw:removesecondname" &&
        eventId !== "cw:settitle" && eventId !== "cw:setsecondname"
    ) {
        return;
    }

    const { targetPlayer, remainingArgs } = resolveTargetAndArgs(ev);

    if (!targetPlayer) {
        if (ev.sourceType === "Entity" && ev.sourceEntity) {
            ev.sourceEntity.sendMessage("§c[称号エラー] 対象のプレイヤーが見つかりません。");
        }
        return;
    }

    if (remainingArgs.length === 0) {
        if (ev.sourceType === "Entity" && ev.sourceEntity) {
            ev.sourceEntity.sendMessage("§c[称号エラー] 称号名を指定してください。例: /scriptevent cw:addtitle プレイヤー名 before 称号名");
        }
        return;
    }

    // 位置 (before / after) の判別
    let position = "before";
    let titleText = "";
    const firstWord = remainingArgs[0].toLowerCase();

    if (firstWord === "before" || firstWord === "前" || firstWord === "0") {
        position = "before";
        titleText = remainingArgs.slice(1).join(" ");
    } else if (firstWord === "after" || firstWord === "後" || firstWord === "1") {
        position = "after";
        titleText = remainingArgs.slice(1).join(" ");
    } else {
        position = "before"; // デフォルト前述
        titleText = remainingArgs.join(" ");
    }

    if (!titleText) {
        if (ev.sourceType === "Entity" && ev.sourceEntity) {
            ev.sourceEntity.sendMessage("§c[称号エラー] 称号名が空です。");
        }
        return;
    }

    const playerData = playerDatas.get(targetPlayer.id) || {
        id: targetPlayer.id,
        name: targetPlayer.name,
        secondname: { before: ["一般的な"], after: ["鯖民"], now: [0, 0] }
    };

    if (!playerData.secondname) {
        playerData.secondname = { before: ["一般的な"], after: ["鯖民"], now: [0, 0] };
    }

    const posLabel = position === "before" ? "前述" : "後述";

    if (eventId === "cw:addtitle" || eventId === "cw:addsecondname" || eventId === "cw:givetitle") {
        const list = position === "before" ? playerData.secondname.before : playerData.secondname.after;
        if (!list.includes(titleText)) {
            list.push(titleText);
            playerDatas.set(targetPlayer.id, playerData);
            targetPlayer.sendMessage(`§a[称号] 称号「${titleText}」(${posLabel}) を獲得しました！`);
            if (ev.sourceEntity && ev.sourceEntity.id !== targetPlayer.id) {
                ev.sourceEntity.sendMessage(`§a[称号] ${targetPlayer.name} に称号「${titleText}」(${posLabel}) を付与しました。`);
            }
        } else {
            if (ev.sourceEntity) {
                ev.sourceEntity.sendMessage(`§e[称号] ${targetPlayer.name} は既に称号「${titleText}」を持っています。`);
            }
        }
    } else if (eventId === "cw:removetitle" || eventId === "cw:removesecondname") {
        const list = position === "before" ? playerData.secondname.before : playerData.secondname.after;
        const index = list.indexOf(titleText);
        if (index !== -1) {
            list.splice(index, 1);
            const nowIdx = position === "before" ? 0 : 1;
            if (playerData.secondname.now[nowIdx] >= list.length) {
                playerData.secondname.now[nowIdx] = 0;
            }
            playerDatas.set(targetPlayer.id, playerData);
            Util.updateNameTag(targetPlayer);

            targetPlayer.sendMessage(`§c[称号] 称号「${titleText}」(${posLabel}) が削除されました。`);
            if (ev.sourceEntity && ev.sourceEntity.id !== targetPlayer.id) {
                ev.sourceEntity.sendMessage(`§a[称号] ${targetPlayer.name} から称号「${titleText}」(${posLabel}) を削除しました。`);
            }
        } else {
            if (ev.sourceEntity) {
                ev.sourceEntity.sendMessage(`§e[称号] ${targetPlayer.name} は称号「${titleText}」を所持していません。`);
            }
        }
    } else if (eventId === "cw:settitle" || eventId === "cw:setsecondname") {
        const list = position === "before" ? playerData.secondname.before : playerData.secondname.after;
        let index = list.indexOf(titleText);
        if (index === -1) {
            list.push(titleText);
            index = list.length - 1;
        }
        const nowIdx = position === "before" ? 0 : 1;
        playerData.secondname.now[nowIdx] = index;
        playerDatas.set(targetPlayer.id, playerData);
        Util.updateNameTag(targetPlayer);

        targetPlayer.sendMessage(`§a[称号] 称号「${titleText}」(${posLabel}) を装着しました！`);
        if (ev.sourceEntity && ev.sourceEntity.id !== targetPlayer.id) {
            ev.sourceEntity.sendMessage(`§a[称号] ${targetPlayer.name} の称号に「${titleText}」(${posLabel}) を設定・装着しました。`);
        }
    }
});