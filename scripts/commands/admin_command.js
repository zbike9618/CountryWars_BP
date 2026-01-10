import { Util } from "../utils/util";
import { system } from "@minecraft/server";

// ===== 管理者用金銭操作コマンド =====
system.afterEvents.scriptEventReceive.subscribe(ev => {
    if (ev.id == "cw:setmoney") {
        let args = ev.message.split(" ");
        if (ev.sourceType == "Entity") {
            Util.setMoney(ev.sourceEntity, Number(args[0]));
            ev.sourceEntity.sendMessage(`§a§l${ev.sourceEntity.name}§r§a§lの所持金を§r§a§l${args[0]}§r§a§lに設定しました`);
        }
    }
})
system.afterEvents.scriptEventReceive.subscribe(ev => {
    if (ev.id == "cw:addmoney") {
        let args = ev.message.split(" ");
        if (ev.sourceType == "Entity") {
            Util.addMoney(ev.sourceEntity, Number(args[0]));
            ev.sourceEntity.sendMessage(`§a§l${ev.sourceEntity.name}§r§a§lの所持金を§r§a§l${args[0]}§r§a§l追加しました`);
        }
    }
})
