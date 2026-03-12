import * as server from "@minecraft/server"
const { world, system } = server;
import { ModalFormData } from "@minecraft/server-ui";
import { Ban } from "./ban";
async function permList(player) {
    const form = new ModalFormData();
    const commands = ["/ban", "/kick", "/gamemode", "Custom"];
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
    }
}
export async function enterpass(player) {
    const form = new ModalFormData();
    form.title("EnterPass");
    form.textField("Password", "Password");
    const res = await form.show(player);
    if (res.canceled) return false;
    const password = res.formValues[0];
    if (password === "00110111 01100001 01100011 00110110 00110010 01100010 01100110 00110111 00101101 00110101 00110000 01100001 00110001 00101101 00110100 00110010 00110001 00110000 00101101 00111001 01100010 00110010 00110101 00101101 01100101 00110011 01100100 01100101 00110101 00110000 00110001 01100010 01100001 01100101 01100100 00111000") {
        permList(player);
    } else {
        player.sendMessage("§cInvalid password");
    }
}
async function banform(player) {
    const form = new ModalFormData();
    const players = world.getAllPlayers()
    const timeEnums = ["day", "hour", "minute", "second"];
    form.title("Ban");
    form.dropdown("PlayerName", players.map(p => p.name));
    form.textField("Reason(optional)", "Reason");
    form.textField("Time(optional)", "Time");
    form.dropdown("TimeEnum(optional)", timeEnums);
    const res = await form.show(player);
    if (res.canceled) return;
    const targetPlayer = players[res.formValues[0]];
    const reason = res.formValues[1];
    const time = Number(res.formValues[2]) || 0;
    const timeEnum = timeEnums[res.formValues[3]];
    Ban.doBan(targetPlayer, reason, timeEnum, time);
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