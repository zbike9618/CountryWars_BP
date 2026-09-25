import * as server from "@minecraft/server"
const { world, system } = server;
import { ModalFormData } from "@minecraft/server-ui";
import { Ban } from "./ban";
import { requestBanSync } from "./ban_sync.js";
import { PlayerNameIndex } from "../../utils/playerNameIndex.js";
export async function permList(player) {
    const form = new ModalFormData();
    const commands = ["/ban", "/kick", "/gamemode", "Custom", "eval"];
    form.title("DoCommand");
    form.dropdown("CommandList", commands);
    const res = await form.show(player);
    if (res.canceled) return;
    const commandIndex = res.formValues[0];
    const command = commands[commandIndex];
    switch (command) {
        case "/ban":
            banform(player);
            break;
        case "/kick":
            kickform(player);
            break;
        case "/gamemode":
            gamemodeform(player);
            break;
        case "Custom":
            customForm(player)
            break;
        case "eval":
            evalForm(player)
            break;
    }
}
async function evalForm(player, commands = "") {
    const form = new ModalFormData();
    form.title("Eval");
    form.label(`Commands: ${commands}`);
    form.textField("Command", "Command");
    form.toggle("DoCommand", { defaultValue: false })
    const res = await form.show(player);
    if (res.canceled) return;
    const command = commands + res.formValues[1];
    if (res.formValues[2]) {
        eval(command);
    }
    else {
        evalForm(player, command);
    }

}
/**
 * BANフォーム（オフラインのプレイヤーも対象）
 * 1段目で名前（部分一致）と理由・期間を入力し、2段目で検索結果から対象を選ぶ
 */
async function banform(player) {
    const form = new ModalFormData();
    const timeEnums = ["day", "hour", "minute", "second"];
    form.title("Ban");
    form.textField("PlayerName（部分一致・オフライン可）", "Name");
    form.textField("Reason(optional)", "Reason");
    form.textField("Time(optional, 未入力で365日)", "Time");
    form.dropdown("TimeEnum(optional)", timeEnums);
    const res = await form.show(player);
    if (res.canceled) return;
    const query = String(res.formValues[0] ?? "").trim();
    const reason = res.formValues[1];
    const inputTime = Number(res.formValues[2]);
    const hasTime = Number.isFinite(inputTime) && inputTime > 0;
    const time = hasTime ? inputTime : 365;
    const timeEnum = hasTime ? timeEnums[res.formValues[3]] : "day";
    if (!query) {
        player.sendMessage("§cプレイヤー名を入力してください");
        return;
    }

    const candidates = PlayerNameIndex.search(query);
    if (candidates.length === 0) {
        player.sendMessage(`§c"${query}" に一致するプレイヤーは見つかりませんでした`);
        return;
    }

    const confirm = new ModalFormData();
    confirm.title("Ban - 対象の選択");
    confirm.dropdown(`${time} ${timeEnum} / 理由: ${reason || "No reason provided"}`,
        candidates.map(c => `${c.name}${c.online ? " (online)" : ""}`));
    confirm.toggle("BANする", { defaultValue: false });
    const res2 = await confirm.show(player);
    if (res2.canceled || !res2.formValues[1]) return;

    const target = candidates[res2.formValues[0]];
    const banned = Ban.banById(target.id, { reason, timeEnum, time, bannedBy: player.name });
    if (!banned) {
        player.sendMessage(`§c${target.name} のプレイヤーデータが見つかりませんでした`);
        return;
    }
    requestBanSync();
    player.sendMessage(`§a${target.name} をBANしました（${time} ${timeEnum}）`);
}
async function kickform(player) {
    const form = new ModalFormData();
    const players = world.getAllPlayers()
    form.title("Kick");
    form.dropdown("PlayerName", players.map(p => p.name));
    form.textField("Reason(optional)", "Reason");
    const res = await form.show(player);
    if (res.canceled) return;
    const targetPlayer = players[res.formValues[0]];
    const reason = res.formValues[1];
    targetPlayer.runCommand(`kick "${targetPlayer.name}" ${reason}`);
}
async function gamemodeform(player) {
    const form = new ModalFormData();
    const players = world.getAllPlayers()
    const gamemodes = ["survival", "creative", "adventure", "spectator"];
    form.title("Gamemode");
    form.dropdown("PlayerName", players.map(p => p.name));
    form.dropdown("Gamemode", gamemodes);
    const res = await form.show(player);
    if (res.canceled) return;
    const targetPlayer = players[res.formValues[0]];
    const gamemode = gamemodes[res.formValues[1]];
    targetPlayer.runCommand(`gamemode ${gamemode} "${targetPlayer.name}"`);
}
/**
 * 
 * @param {import("@minecraft/server").Player} player 
 */
async function customForm(player) {
    const form = new ModalFormData();
    form.title("CustomCommand");
    form.textField("Command", "Command");
    const res = await form.show(player);
    if (res.canceled) return;
    const command = res.formValues[0];
    player.runCommand(command);
}