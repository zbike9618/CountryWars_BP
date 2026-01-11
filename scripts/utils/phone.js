import { world } from "@minecraft/server";
import { ActionFormData } from "@minecraft/server-ui";
import { Dypro } from "./dypro.js";
import { ChestFormData } from "./chest_shop/chest-ui.js";
const playerDatas = new Dypro("player");

//スマホ使用時
world.afterEvents.itemUse.subscribe((event) => {
    const player = event.source;
    const itemId = event.itemStack.typeId;
    if (itemId.includes("toyphone")) {
        show_form(player)
    }
});

function show_form(player){
const form = new ChestFormData()
const data = playerDatas.get(player.id);
    const money = data.money ?? 0;
    form.setTitle("ZPhone"),
    form.setButton(0, { iconPath: "textures/items/gold_ingot", 
    name: { translate: "check.money" }, 
    stackAmount: 1, 
    lore: [`$${money}`], 
    isGlint: true, editedName: true }),

    form.setButton(1, { iconPath: "textures/items/ender_pearl", 
    name: { translate: "player.teleport" }, 
    stackAmount: 1, 
    lore: ["<<Click here>>"], 
    isGlint: true, editedName: true })
    
    form.setButton(2, { iconPath: "textures/items/later", 
    name: { translate: "message.system" }, 
    stackAmount: 1, 
    lore: ["<<Click here>>"], 
    isGlint: true, editedName: true })

    form.setButton(3, { iconPath: "textures/items/nether_star", 
    name: { translate: "goto.lobby" }, 
    stackAmount: 1, 
    lore: ["<<Click here>>"], 
    isGlint: true, editedName: true })

    form.setButton(4, { iconPath: "textures/items/wood_axe", 
    name: { translate: "select.job" }, 
    stackAmount: 1, 
    lore: ["<<Click here>>"], 
    isGlint: true, editedName: true })
    form.show(player).then((responce) => {
        switch(responce.selection){
            case 0:
                player.runCommand("money");
                break;
            case 1:
                player.runCommand("tpa");
                break;
            case 2:
                player.runCommand("mb");
                break;
            case 3:
                player.runCommand("tp @s ~~10~");
                player.sendMessage({ translate: "went.lobby" })
                break;
            case 4:
                player.runCommand("jobs");
            default:
                break;
            }
    })
};