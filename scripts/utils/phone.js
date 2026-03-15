import { world } from "@minecraft/server";
import { ActionFormData } from "@minecraft/server-ui";
import { Dypro } from "./dypro.js";
import { ChestFormData } from "./chest_shop/chest-ui.js";
import { SecondName } from "./secondname.js";
import { Help } from "./help.js";
import { Country } from "./country.js";
import { Bank } from "./bank.js";
const playerDatas = new Dypro("player");
const countryDatas = new Dypro("country");
//スマホ使用時
world.afterEvents.itemUse.subscribe((event) => {
    const player = event.source;
    const itemId = event.itemStack.typeId;
    if (itemId.includes("toyphone")) {
        show_form(player)
    }
});

function show_form(player) {
    const form = new ChestFormData("small")
    const data = playerDatas.get(player.id);
    const money = data.money || 0;
    form.setTitle("ZPhone"),
        form.setButton(0, {
            iconPath: "textures/items/coin_100",
            name: "cw.phone.check.money",
            stackAmount: 1,
            lore: [`¥${money}`],
            isGlint: true, editedName: true
        }),

        form.setButton(1, {
            iconPath: "textures/items/ender_pearl",
            name: "cw.phone.player.teleport",
            stackAmount: 1,
            lore: ["<<Click here>>"],
            isGlint: true, editedName: true
        })

    form.setButton(2, {
        iconPath: "textures/ui/message",
        name: "cw.phone.message.system",
        stackAmount: 1,
        lore: ["<<Click here>>"],
        isGlint: true, editedName: true
    })

    form.setButton(3, {
        iconPath: "textures/items/compass_item",
        name: "cw.phone.goto.lobby",
        stackAmount: 1,
        lore: ["<<Click here>>"],
        isGlint: true, editedName: true
    })

    form.setButton(4, {
        iconPath: "textures/items/iron_pickaxe",
        name: "cw.phone.select.job",
        stackAmount: 1,
        lore: ["<<Click here>>"],
        isGlint: true, editedName: true
    })

    form.setButton(5, {
        iconPath: "textures/items/bed_red",
        name: "cw.phone.set.home",
        stackAmount: 1,
        lore: ["<<Click here>>"],
        isGlint: true, editedName: true
    })

    form.setButton(6, {
        iconPath: "textures/items/bed_red",
        name: "cw.phone.goto.home",
        stackAmount: 1,
        lore: ["<<Click here>>"],
        isGlint: true, editedName: true
    })
    form.setButton(7, {
        iconPath: "textures/items/name_tag",
        name: "cw.secondnameform.title",
        stackAmount: 1,
        lore: ["<<Click here>>"],
        isGlint: true, editedName: true
    })
    form.setButton(8, {
        iconPath: "textures/blocks/gold_block",
        name: "cw.bankform.title",
        stackAmount: 1,
        lore: ["<<Click here>>"],
        isGlint: true, editedName: true
    })
    form.setButton(9, {
        iconPath: "textures/items/security_camera",
        name: "cw.scform.title",
        stackAmount: 1,
        lore: ["<<Click here>>"],
        isGlint: true, editedName: true
    })
    form.setButton(10, {
        iconPath: "textures/ui/message",
        name: "cw.wchatform.title",
        stackAmount: 1,
        lore: ["<<Click here>>"],
        isGlint: true, editedName: true
    })
    form.setButton(11, {
        iconPath: "textures/ui/message",
        name: "cw.lchatform.title",
        stackAmount: 1,
        lore: ["<<Click here>>"],
        isGlint: true, editedName: true
    })
    form.setButton(12, {
        iconPath: "textures/ui/message",
        name: "cw.cchatform.title",
        stackAmount: 1,
        lore: ["<<Click here>>"],
        isGlint: true, editedName: true
    })
    form.setButton(13, {
        iconPath: "textures/ui/message",
        name: "cw.achatform.title",
        stackAmount: 1,
        lore: ["<<Click here>>"],
        isGlint: true, editedName: true
    })
    form.setButton(14, {
        iconPath: "textures/ui/navbar-friends-icon",
        name: "cw.playermarket.title",
        stackAmount: 1,
        lore: ["<<Click here>>"],
        isGlint: true, editedName: true
    })
    form.setButton(15, {
        iconPath: "textures/ui/store_home_icon",
        name: "cw.shop.title",
        stackAmount: 1,
        lore: ["<<Click here>>"],
        isGlint: true, editedName: true
    })
    form.setButton(16, {
        iconPath: "textures/items/map_filled",
        name: "MAP",
        stackAmount: 1,
        lore: ["<<Click here>>"],
        isGlint: true, editedName: true
    })
    form.setButton(17, {
        iconPath: "textures/items/book_normal",
        name: "Tips（お役立ち情報）の受け取り設定",
        stackAmount: 1,
        lore: ["<<Click here>>"],
        isGlint: true, editedName: true
    })
    form.setButton(26, {
        iconPath: "textures/ui/how_to_play_button_pressed_light",
        name: "cw.phone.help",
        stackAmount: 1,
        lore: ["comming soon..."],
        isGlint: true, editedName: true
    })

    form.show(player).then((responce) => {
        switch (responce.selection) {
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
                player.runCommand("lobby");
                break;
            case 4:
                player.runCommand("jobs");
                break;
            case 5:
                player.runCommand("sethome");
                break;
            case 6:
                player.runCommand("home");
                break;
            case 7:
                SecondName.secondNameForm(player);
                break;
            case 8:
                Bank.bankForm(player);
                break;
            case 9:
                player.runCommand("sc")
                break;
            case 10:
                player.runCommand("wchat")
                break;
            case 11:
                player.runCommand("lchat")
                break;
            case 12:
                player.runCommand("cchat")
                break;
            case 13:
                player.runCommand("achat")
                break;
            case 14:
                player.runCommand("pm")
                break;
            case 15:
                player.runCommand("shop")
                break;
            case 16:
                player.runCommand("map")
                break;
            case 17:
                player.runCommand("sv:tips")
                break;
            case 26:
                Help.mainForm(player);
                break;
            default:
                break;
        }
    })
};