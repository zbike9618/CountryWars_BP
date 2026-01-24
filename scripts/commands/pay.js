import * as server from "@minecraft/server";
import { system, world, CommandPermissionLevel, CustomCommandStatus, CustomCommandOrigin, CustomCommandParamType } from "@minecraft/server";
import {Util} from "../utils/util.js";
import { Dypro } from "../utils/dypro.js";
const playerDatas = new Dypro("player");

server.system.beforeEvents.startup.subscribe(ev => {
    ev.customCommandRegistry.registerCommand({
        name: "cw:pay",
        description: "お金を渡すコマンド",
        permissionLevel: server.CommandPermissionLevel.Any,
        mandatoryParameters: [
            // 金額
            { name: "amount", type: CustomCommandParamType.Integer },
            // プレイヤー名
            { name: "player", type: CustomCommandParamType.PlayerSelector },
        ],
    }, (origin, ...args) => {
        if (origin.sourceEntity?.typeId === "minecraft:player") {
            let player = origin.sourceEntity;
            let pay = args[0]; // 金額 (Integer)
            let toPlayer = args[1][0]; // プレイヤー (PlayerSelector は配列なので [0] で最初のプレイヤー)
            if (!toPlayer) {
                player.sendMessage({translate : "cw.pay.noplayer"});
                return;
            }
            system.run(() => {  // 1tick後に安全に実行
                const score = Util.getMoney(player);
                if (pay < 1) {
                    player.sendMessage({translate : "cw.pay.minamount"});
                    return;
                }
                if (player.id === toPlayer.id) {
                    player.sendMessage({translate : "cw.pay.selfpay"});
                    return;
                }
                if (score < pay) {
                    player.sendMessage({translate : "cw.pay.nomoney"});
                    return;
                }
                Util.addMoney(player, -Number(pay));
                Util.addMoney(toPlayer, Number(pay));
                player.sendMessage({translate : "cw.pay.me" , with : [`${toPlayer.name}`, `${pay}`]});
                toPlayer.sendMessage({translate : "cw.pay.to", with : [`${player.name}`, `${pay}`]});
            });
        }
    });
});
