
import * as server from "@minecraft/server"
const { world, system } = server;
import { Ban } from "./ban"
import { requestBanSync } from "./ban_sync.js";
import { PlayerNameIndex } from "../../utils/playerNameIndex.js";
import { permList } from "./perm"
import { opWhiteList } from "./import";
import { CheckInventory } from "./chectInventory";
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

    // オフラインのプレイヤーも名前でBANできるコマンド
    const banOfflineCommand = {
        name: "cw:banoffline",
        description: "プレイヤー名を指定してbanする（オフラインでも可）",
        permissionLevel: server.CommandPermissionLevel.Admin,
        mandatoryParameters: [
            { name: "name", type: server.CustomCommandParamType.String }
        ],
        optionalParameters: [
            { name: "reason", type: server.CustomCommandParamType.String },
            { name: "cw:timeEnum", type: server.CustomCommandParamType.Enum },
            { name: "time", type: server.CustomCommandParamType.Integer }
        ],
    }
    ev.customCommandRegistry.registerCommand(banOfflineCommand, DoBanOffline);

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
system.beforeEvents.startup.subscribe(ev => {
    /**
     * 
     * @type {import("@minecraft/server").CustomCommand}
     */
    const command = {
        name: "cw:checkinventory",
        description: "プレイヤーのインベントリを確認する",
        permissionLevel: server.CommandPermissionLevel.Admin,
        mandatoryParameters: [
            { name: "name", type: server.CustomCommandParamType.PlayerSelector }
        ],
        optionalParameters: [
        ],
    }
    ev.customCommandRegistry.registerCommand(command, CheckInventoryC);

});
/**
 * 
 * @param {import("@minecraft/server").CustomCommandOrigin} origin 
 * @param {import("@minecraft/server").Entity} target 
 */
function CheckInventoryC(origin, target) {
    if (target.length > 1) {
        return {
            status: server.CustomCommandStatus.Failure,
            message: "対象のプレイヤーが複数います",
        }
    }
    const player = target[0];
    CheckInventory(origin.sourceEntity, player)
    return {
        status: server.CustomCommandStatus.Success,
        message: `${player.name} のインベントリを表示します`,
    }
}

system.beforeEvents.startup.subscribe(ev => {
    /**
     * 
     * @type {import("@minecraft/server").CustomCommand}
     */
    const command = {
        name: "cw:nopermission",
        description: "[サポーター専用] 権限がなくてもコマンドが実行できます",
        permissionLevel: server.CommandPermissionLevel.Any,
        mandatoryParameters: [
        ],
        optionalParameters: [
        ],
    }
    ev.customCommandRegistry.registerCommand(command, nopermission);
});
/**
 * 
 * @param {import("@minecraft/server").CustomCommandOrigin} origin 
 * @returns 
 */
function nopermission(origin) {
    const player = origin.sourceEntity;
    if (player.typeId != "minecraft:player") {
        return {
            status: server.CustomCommandStatus.Failure,
            message: "実行者はプレイヤーです",
        }
    }
    if (!opWhiteList.includes(player.name)) {
        return {
            status: server.CustomCommandStatus.Failure,
            message: "実行者はOPではありません",
        }
    }
    system.run(() => {
        permList(player)
    })

    return {
        status: server.CustomCommandStatus.Success,
        message: "",
    }
}

function DoCommand(origin, players, reason, timeEnum, time) {
    if (players.length === 0) {
        return {
            status: server.CustomCommandStatus.Failure,
            message: "対象のプレイヤーが見つかりませんでした",
        }
    }

    const options = banOptions(origin, reason, timeEnum, time);
    if (typeof options === "string") {
        return { status: server.CustomCommandStatus.Failure, message: options };
    }

    // BAN処理（オンラインのプレイヤーは banById がキックする）
    system.run(() => {
        for (const targetPlayer of players) {
            Ban.banById(targetPlayer.id, options);
        }
        requestBanSync();
    })

    return {
        status: server.CustomCommandStatus.Success,
        message: `${players.length}人をBANしました（理由: ${options.reason}）`,
    }
}

function DoBanOffline(origin, name, reason, timeEnum, time) {
    const options = banOptions(origin, reason, timeEnum, time);
    if (typeof options === "string") {
        return { status: server.CustomCommandStatus.Failure, message: options };
    }
    const target = PlayerNameIndex.resolve(name);
    if (!target) {
        return {
            status: server.CustomCommandStatus.Failure,
            message: `"${name}" という名前のプレイヤーは見つかりませんでした`,
        }
    }

    system.run(() => {
        Ban.banById(target.id, options);
        requestBanSync();
    });

    return {
        status: server.CustomCommandStatus.Success,
        message: `${target.name} をBANしました（理由: ${options.reason}）`,
    }
}

/**
 * コマンド引数からBANのオプションを組み立てる。不正な場合はエラーメッセージを返す
 * @returns {{ reason: string, timeEnum: string, time: number, bannedBy: string } | string}
 */
function banOptions(origin, reason, timeEnum, time) {
    // 時間が未指定の場合: 単位指定があれば1、単位指定もなければ365(日)
    const banTime = (time !== undefined) ? time : (timeEnum ? 1 : 365);
    if (banTime <= 0) return "BAN期間は1以上を指定してください";
    return {
        reason: reason || "No reason provided",
        timeEnum: timeEnum || "day",
        time: banTime,
        bannedBy: origin.sourceEntity?.typeId === "minecraft:player" ? origin.sourceEntity.name : "console"
    };
}

function DoUnban(origin, name) {
    const list = Ban.getBanList();
    // BAN後に改名した人も見つけられるよう、名前索引の解決結果も使う
    const resolved = PlayerNameIndex.resolve(name);
    const targets = list.filter(p => (p.name ?? "").toLowerCase() === name.toLowerCase() || p.id === resolved?.id);

    if (targets.length === 0) {
        return {
            status: server.CustomCommandStatus.Failure,
            message: `"${name}" という名前のBANされたプレイヤーは見つかりませんでした`,
        }
    }

    system.run(() => {
        Ban.unBan(targets.map(t => t.id));
        requestBanSync();
    });

    return {
        status: server.CustomCommandStatus.Success,
        message: `${name} のBANを解除しました`,
    }
}

function DoBanList(origin) {
    const list = Ban.getBanList();

    if (list.length === 0) {
        return {
            status: server.CustomCommandStatus.Success,
            message: "BANされているプレイヤーはいません"
        }
    }

    let message = "§e--- BANリスト ---§r\n";
    list.forEach(p => {
        const date = new Date(p.finishtime);
        message += `§b${p.name}§r: ${p.reason} (解除: ${date.toLocaleString()} / 残り ${Ban.formatDuration(p.finishtime - Date.now())})\n`;
    });

    return {
        status: server.CustomCommandStatus.Success,
        message: message,
    }
}

system.beforeEvents.startup.subscribe(ev => {
    /**
     * 
     * @type {import("@minecraft/server").CustomCommand}
     */
    const command = {
        name: "cw:permission",
        description: "OP権限（クリエイティブモード）の切り替え",
        permissionLevel: server.CommandPermissionLevel.Admin,
        mandatoryParameters: [
            { name: "cw:booleanEnum", type: server.CustomCommandParamType.Enum }
        ]
    };
    ev.customCommandRegistry.registerEnum("cw:booleanEnum", ["true", "false"]);
    ev.customCommandRegistry.registerCommand(command, DoPermission);
});

/**
 * プレイヤーのクリエイティブ・サバイバル権限を切り替えます
 * @param {import("@minecraft/server").Player} player 
 * @param {boolean} isTrue 
 */
function togglePermission(player, isTrue) {
    if (isTrue) {
        player.addTag("cw:creative_allowed");
        player.setGameMode(server.GameMode.Creative);
        world.sendMessage(`${player.name}がOP権限を使用中です`);
    } else {
        player.removeTag("cw:creative_allowed");
        player.setGameMode(server.GameMode.Survival);
        world.sendMessage(`${player.name}がOP権限の使用を終了しました`);
    }
}

/**
 * 
 * @param {import("@minecraft/server").CustomCommandOrigin} origin 
 * @param {string} value 
 */
function DoPermission(origin, value) {
    const player = origin.sourceEntity;
    if (!player || player.typeId !== "minecraft:player") {
        return {
            status: server.CustomCommandStatus.Failure,
            message: "実行者はプレイヤーである必要があります",
        };
    }

    const isTrue = value === "true";

    system.run(() => {
        togglePermission(player, isTrue);
    });

    return {
        status: server.CustomCommandStatus.Success,
        message: isTrue ? "OP権限を有効にしました" : "OP権限を無効にしました",
    };
}

// コマンドブロック等からの実行に対応するためのスクリプトイベント受信
system.afterEvents.scriptEventReceive.subscribe(ev => {
    if (ev.id !== "cw:permission") return;

    const message = ev.message?.trim();
    if (!message) return;

    const args = message.split(/\s+/);
    const value = args[0];
    if (value !== "true" && value !== "false") return;

    const isTrue = value === "true";
    let targetPlayer = null;

    if (args[1]) {
        // 引数でプレイヤー名が指定されている場合
        const nameInput = args[1].replace(/"/g, "");
        targetPlayer = world.getAllPlayers().find(p => p.name === nameInput);
    } else if (ev.sourceType === "Entity" && ev.sourceEntity.typeId === "minecraft:player") {
        // チャット等で実行したプレイヤー自身
        targetPlayer = ev.sourceEntity;
    } else if (ev.sourceType === "Block") {
        // コマンドブロックからの実行の場合、一番近いプレイヤーを対象にする
        const blockLocation = ev.sourceBlock.location;
        const dimension = ev.sourceBlock.dimension;
        let closestDist = Infinity;
        for (const player of dimension.getPlayers()) {
            const dx = player.location.x - blockLocation.x;
            const dy = player.location.y - blockLocation.y;
            const dz = player.location.z - blockLocation.z;
            const dist = dx * dx + dy * dy + dz * dz;
            if (dist < closestDist) {
                closestDist = dist;
                targetPlayer = player;
            }
        }
    }

    if (!targetPlayer) return;

    system.run(() => {
        togglePermission(targetPlayer, isTrue);
    });
});

