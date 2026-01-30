import * as server from "@minecraft/server"
const { world, system } = server;
import { ActionFormData, ModalFormData } from "@minecraft/server-ui";
import { JsonDypro } from "../util/jsonDypro.js";
const settingData = new JsonDypro("tweakeroo_setting")
/**
 * @param {server.Player} player
 */
export async function tweakerooSetting(player) {


    const form = new ActionFormData()
    form.title("TweakSetting")
    form.button("Tools")
    form.button("Blocks")
    form.button("Move")
    const res = await form.show(player)
    if (res.canceled) return;
    if (res.selection == 0) {
        ToolsSetting(player)
    }
    if (res.selection == 1) {
        BlocksSetting(player)
    }
    if (res.selection == 2) {
        MoveSetting(player)
    }
}
async function ToolsSetting(player) {
    const form = new ModalFormData()
    form.title("ToolsSetting")
    form.toggle("TweakSwapAlmostBrokenTools", { defaultValue: settingData.get(player)?.swapAlmostBrokenTools })
    form.toggle("TweakSwapTools", { defaultValue: settingData.get(player)?.swapTools })
    const res = await form.show(player)
    if (res.canceled) {
        tweakerooSetting(player);
        return;
    }
    settingData.set(player, "swapAlmostBrokenTools", res.formValues[0])
    settingData.set(player, "swapTools", res.formValues[1])
}
async function BlocksSetting(player) {
    const form = new ModalFormData()
    form.title("BlocksSetting")
    form.toggle("TweakHandRestock", { defaultValue: settingData.get(player)?.handRestock })
    const res = await form.show(player)
    if (res.canceled) {
        tweakerooSetting(player);
        return;
    }
    settingData.set(player, "handRestock", res.formValues[0])
}
async function MoveSetting(player) {
    const form = new ModalFormData()
    form.title("MoveSetting")
    form.toggle("TweakFakeSneaking", { defaultValue: settingData.get(player)?.fakeSneaking })
    const res = await form.show(player)
    if (res.canceled) {
        tweakerooSetting(player);
        return;
    }
    settingData.set(player, "fakeSneaking", res.formValues[0])
}
