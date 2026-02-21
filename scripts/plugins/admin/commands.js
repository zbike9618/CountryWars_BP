
import * as server from "@minecraft/server"
const { world, system } = server;
import { Ban } from "./ban"
system.beforeEvents.startup.subscribe(ev => {
    /**
     * 
     * @type {import("@minecraft/server").CustomCommand}
     */
    const command = {
        name: "cw:ban",
        description: "プレイヤーをbanする",
        permissionLevel: server.CommandPermissionLevel.Admin,
        mandatoryParameters: [
            { name: "name", type: server.CustomCommandParamType.PlayerSelector }
        ],
        optionalParameters: [
            { name: "reason", type: server.CustomCommandParamType.String },
            { name: "cw:timeEnum", type: server.CustomCommandParamType.Enum },
            { name: "time", type: server.CustomCommandParamType.Integer }
        ],
    }
    ev.customCommandRegistry.registerEnum("cw:timeEnum", ["day", "hour", "minute", "second"])
    ev.customCommandRegistry.registerCommand(command, DoCommand);

    // unbanコマンド
    const unbanCommand = {
        name: "cw:unban",
        description: "プレイヤーのbanを解除する",
        permissionLevel: server.CommandPermissionLevel.Admin,
        mandatoryParameters: [
            { name: "name", type: server.CustomCommandParamType.String }
        ]
    }
    ev.customCommandRegistry.registerCommand(unbanCommand, DoUnban);

    // banlistコマンド
    const banlistCommand = {
        name: "cw:banlist",
        description: "banされているプレイヤーを表示する",
        permissionLevel: server.CommandPermissionLevel.Admin,
    }
    ev.customCommandRegistry.registerCommand(banlistCommand, DoBanList);
});

function DoCommand(origin, players, reason, timeEnum, time) {
    if (players.length === 0) {
        return {
            status: server.CustomCommandStatus.Failure,
            message: "対象のプレイヤーが見つかりませんでした",
        }
    }

    // 引数の補完
    const banReason = reason || "No reason provided";
    const banTimeEnum = timeEnum || "day";
    // 時間が未指定の場合: 単位指定があれば1、単位指定もなければ365(日)
    const banTime = (time !== undefined) ? time : (timeEnum ? 1 : 365);

    // BAN処理
    system.run(() => {
        Ban.setBan(players, banReason, banTimeEnum, banTime);

        // ログイン中のプレイヤーをキック
        for (const targetPlayer of players) {
            targetPlayer.runCommand(`kick "${targetPlayer.name}" BAN: ${banReason}`);
        }
    })

    return {
        status: server.CustomCommandStatus.Success,
        message: { translate: "cw.admin.ban.success", with: [`${players.length}`, banReason] },
    }
}

function DoUnban(origin, name) {
    const list = Ban.getBanList();
    const targets = list.filter(p => p.name === name);

    if (targets.length === 0) {
        return {
            status: server.CustomCommandStatus.Failure,
            message: `"${name}" という名前のBANされたプレイヤーは見つかりませんでした`,
        }
    }

    system.run(() => {
        Ban.unBan(targets.map(t => t.id));
    });

    return {
        status: server.CustomCommandStatus.Success,
        message: { translate: "cw.admin.unban.success", with: [name] },
    }
}

function DoBanList(origin) {
    const list = Ban.getBanList();

    if (list.length === 0) {
        return {
            status: server.CustomCommandStatus.Success,
            message: { translate: "cw.admin.banlist.empty" }
        }
    }

    let message = "§e--- BANリスト ---§r\n";
    list.forEach(p => {
        const date = new Date(p.finishtime);
        message += `§b${p.name}§r: ${p.reason} (解除: ${date.toLocaleString()})\n`;
    });

    return {
        status: server.CustomCommandStatus.Success,
        message: message,
    }
}
