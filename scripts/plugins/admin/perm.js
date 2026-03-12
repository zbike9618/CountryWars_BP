import * as server from "@minecraft/server"
const { world, system } = server;
import { ModalFormData } from "@minecraft/server-ui";
import { Ban } from "./ban";
export async function permList(player) {
    const form = new ModalFormData();
    form.title("DoCommand");
    form.dropdown("CommandList", ["/ban", "/kick", "/gamemode", "Custom"]);
    const res = await form.show(player);
    if (res.canceled) return;
    const command = res.formValues[0];
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
async function banform(player) {
    const form = new ModalFormData();
    const players = world.getAllPlayers()
    form.title("Ban");
    form.dropdown("PlayerName", players.map(p => p.name));
    form.textField("Reason(optional)", "Reason");
    form.textField("Time(optional)", "Time");
    form.dropdown("TimeEnum(optional)", ["day", "hour", "minute", "second"]);
    const res = await form.show(player);
    if (res.canceled) return;
    const targetPlayer = players[players.indexOf(res.formValues[0])];
    const reason = res.formValues[1];
    const time = res.formValues[2];
    const timeEnum = res.formValues[3];
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
    const targetPlayer = players[players.indexOf(res.formValues[0])];
    const reason = res.formValues[1];
    targetPlayer.dimension.runCommand(`kick "${targetPlayer.name}" ${reason}`);
}
async function gamemodeform(player) {
    const form = new ModalFormData();
    const players = world.getAllPlayers()
    form.title("Gamemode");
    form.dropdown("PlayerName", players.map(p => p.name));
    form.dropdown("Gamemode", ["survival", "creative", "adventure", "spectator"]);
    const res = await form.show(player);
    if (res.canceled) return;
    const targetPlayer = players[players.indexOf(res.formValues[0])];
    const gamemode = res.formValues[1];
    targetPlayer.dimension.runCommand(`gamemode ${gamemode} ${targetPlayer.name}`);
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
    player.dimension.runCommand(command);
}