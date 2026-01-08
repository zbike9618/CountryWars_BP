import * as server from "@minecraft/server"
const { world, system } = server;
import { ActionFormData, ModalFormData, MessageFormData } from "@minecraft/server-ui"
import { ChestFormData } from "./chest_shop/chest-ui.js";
import { Util } from "./util.js";
import { Dypro } from "./dypro.js";
import { Data } from "./data.js";
const countryDatas = new Dypro("country");
const playerDatas = new Dypro("player");
export class Country {

    static async makeForm(player) {
        const form = new ModalFormData()
        form.title({ translate: "cw.mcform.title" })
        form.textField({ translate: "cw.mcform.WriteCountryNameLabel" }, { translate: "cw.mcform.WriteCountryNamePlaceholder" })//国名
        form.toggle({ translate: "cw.mcform.toggle" }, { defaultValue: false, tooltip: { translate: "cw.mcform.toggleTooltip" } })//平和主義か
        const res = await form.show(player)
        if (res.canceled) return;
        this.make(player, res.formValues)

    }
    //constructurはなし
    /**
     * 国を作る
     * @param {import("@minecraft/server").Entity} player 
     * 
     */
    static make(player, { countryName, isPeace }) {
        const id = countryDatas.idList.length + 1;
        const countryData =
        {
            id,
            name: countryName,
            description: "",
            money: 0,
            tax: 0,//税率[%]
            isPeace: isPeace,
            players: [player.id],
            playerpermission: { "国王": [player.id] },
            permissions: { "国王": [] },
            //同盟国などはあとで

        }
        countryDatas.set(id, countryData);
        const playerData = playerDatas.get(player.id);
        playerData.country = id;
        playerDatas.set(player.id, playerData);
    }
    static delete(countryData) {
        countryDatas.delete(countryData.id);
    }
    static async setting(player, countryData) {
        if (countryData == "none") {
            const form = new MessageFormData()
            form.title({ translate: "cw.scform.title" })
            form.body({ translate: "cw.scform.unjoincountry" })
            form.button1({ translate: "cw.form.cancel" })
            form.button2({ translate: "cw.form.cancel" })
            form.show(player)
            return;
        }
        const form = new ActionFormData()
        form.title({ translate: "cw.scform.title" })
        form.button({ translate: "cw.scform.information" })
        form.button({ translate: "cw.scform.tax" })
        form.button({ translate: "cw.scform.permission" })
        form.button({ translate: "cw.scform.delete" })

        const res = await form.show(player)
        if (res.canceled) return;
        if (res.selection == 0) {
            Information.information(player, countryData)
        }
        if (res.selection == 1) {
            this.tax(countryData)
        }
        if (res.selection == 2) {
            Permission.permission(player, countryData)
        }
        if (res.selection == 3) {
            this.delete(countryData)
        }
    }




}
class Information {
    static async information(player, countryData) {
        const form = new MessageFormData()

        form.title({ translate: "cw.scform.information" })
        form.body({ translate: "cw.scform.informations", with: [`${countryData.name}`, `${countryData.description}`] })
        form.button1({ translate: "cw.form.redo" })
        if (hasPermission(player, "information")) {
            form.button2({ translate: "cw.scform.setting" })
        }
        else {
            form.button2({ translate: "cw.form.cancel" })
        }

        const res = await form.show(player)
        this.edit(player, countryData)

    }
    static async edit(player, countryData) {
        const form = new ModalFormData()
        form.title({ translate: "cw.scform.information" })
        form.textField({ translate: "cw.mcform.WriteCountryNameLabel" }, "Press Name", { defaultValue: countryData.name })//国名
        form.toggle({ translate: "cw.mcform.toggle" }, { defaultValue: countryData.isPeace, tooltip: { translate: "cw.mcform.toggleTooltip" } })//平和主義か
        const res = await form.show(player)
        if (res.canceled) return;
        countryData.name = res.formValues[0]
        countryData.isPeace = res.formValues[1]
        countryDatas.set(countryData.id, countryData)
    }
}
class Permission {
    static async permission(player, countryData) {
        const form = new ActionFormData()
        form.title({ translate: "cw.scform.permission" })
        form.button({ translate: "cw.scform.permission.set" })
        form.button({ translate: "cw.scform.permission.make" })
        form.button({ translate: "cw.scform.permission.edit" })
        const res = await form.show(player)
        if (res.canceled) return;
        if (res.selection == 0) {
            this.permissionSet(player, countryData)
        }
        if (res.selection == 1) {
            this.permissionMake(player, countryData)
        }
        if (res.selection == 2) {
            this.permissionEdit(player, countryData)
        }
    }
    static async permissionSet(player, countryData) {
        const form = new ModalFormData()
        const playerData = playerDatas.get(player.id)
        form.title({ translate: "cw.scform.permission.set" })
        form.dropdown({ translate: "cw.form.playerchoiseInCountry", }, countryData.players.filter(playerId => playerId != player.id).map(playerId => playerData.name))
        form.dropdown({ translate: "cw.scform.permission.choice", }, Object.keys(countryData.permissions))
        const res = await form.show(player)
        if (res.canceled) return;
        const playerId = countryData.players.filter(playerId => playerId != player.id)[res.formValues[0]]
        const permissionName = Object.keys(countryData.permissions)[res.formValues[1]]
        this.setPermission(playerId, permissionName)

    }
    static async permissionMake(player, countryData) {
        const form = new ModalFormData()
        form.title({ translate: "cw.scform.permission.make" })
        form.textField({ translate: "cw.scform.permission.make.name" }, "Press Name")
        for (const data of Data.permissions) {
            form.toggle({ translate: `cw.scform.permissions.${data}` }, { defaultValue: false })
        }
        const res = await form.show(player)
        if (res.canceled) return;
        const permissionData =
        {
            name: res.formValues[0],
            permissions: res.formValues.slice(1)
        }
        countryData.permissions.push(permissionData)
        countryDatas.set(countryData.id, countryData)
    }
    static async permissionEdit(player, countryData) {
        const form = new ActionFormData()
        form.title({ translate: "cw.scform.permission.edit" })
        form.toggle({ translate: "cw.scform.permission.edit.delete" }, { defaultValue: false, tooltip: "cw.scform.permission.edit.delete.tooltip" })
        form.textField({ translate: "cw.scform.permission.make.name" }, "Press Name", { defaultValue: countryData.permissions[countryData.permissions.length - 1].name })
        for (const data of Data.permissions) {
            form.toggle({ translate: `cw.scform.permissions.${data}` }, { defaultValue: countryData.permissions[countryData.permissions.length - 1].permissions.includes(data) })
        }

        const res = await form.show(player)
        if (res.canceled) return;
    }
    static setPermission(playerId, permissionName) {
        const playerData = playerDatas.get(playerId)
        const countryData = countryDatas.get(playerData.country)
        countryData.playerpermission[permissionName].push(playerId)
        countryDatas.set(playerData.country, countryData)
    }

}
export function hasPermission(playerId, permissionName) {
    const playerData = playerDatas.get(playerId)
    const countryData = countryDatas.get(playerData.country)
    return countryData.playerpermission[permissionName].includes(playerId)
}
