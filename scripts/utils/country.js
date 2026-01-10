import * as server from "@minecraft/server"
const { world, system } = server;
import { ActionFormData, ModalFormData, MessageFormData } from "@minecraft/server-ui"
import { ChestFormData } from "./chest_shop/chest-ui";
import { Util } from "./util";
import { Dypro } from "./dypro";
import { Data } from "./data";
import { ShortPlayerData } from "./playerData";
import { sendDataForPlayers } from "./sendData";
const countryDatas = new Dypro("country");
const playerDatas = new Dypro("player");
export class Country {

    static async makeForm(player) {
        const playerData = playerDatas.get(player.id);
        if (playerData.country) {
            world.sendMessage({ translate: "cw.mcform.alreadyCountry" })
            return;
        }
        const form = new ModalFormData()
        form.title({ translate: "cw.mcform.title" })
        form.textField({ translate: "cw.mcform.WriteCountryNameLabel" }, { translate: "cw.mcform.WriteCountryNamePlaceholder" })//国名
        form.toggle({ translate: "cw.mcform.toggle" }, { defaultValue: false, tooltip: { translate: "cw.mcform.toggleTooltip" } })//平和主義か

        const res = await form.show(player)
        if (res.canceled) return;
        if (countryDatas.idList.map(id => countryDatas.get(id)?.name).includes(res.formValues[0])) {
            world.sendMessage({ translate: "cw.mcform.countryalreadyexists" })
            return;
        }
        this.make(player, { countryName: res.formValues[0], isPeace: res.formValues[1] })

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
            tax: {
                consumption: 0,
                income: 0,
                country: 0,
                customs: 0
            },//税率[%]
            isPeace: isPeace,
            owner: player.id,
            players: [player.id],
            permissions: { "国王": Data.permissions },
            chunkAmount: 0,
            //同盟国などはあとで

        }
        countryDatas.set(id, countryData);
        const playerData = playerDatas.get(player.id);
        playerData.country = id;
        playerData.permission = "国王";
        playerDatas.set(player.id, playerData);
        world.sendMessage({ translate: "cw.mcform.createMessage", with: [countryData.name] })
    }
    static delete(countryData) {
        const players = countryData.players;
        for (const playerId of players) {
            const playerData = playerDatas.get(playerId);
            playerData.country = undefined;
            playerData.permission = "";
            playerDatas.set(playerId, playerData);
        }

        countryDatas.delete(countryData.id);
        world.sendMessage({ translate: "cw.scform.deleteMessage", with: [countryData.name] })
    }
    static async setting(player, countryData) {
        if (countryData == "none") {
            world.sendMessage({ translate: "cw.scform.unjoincountry" })
            return;
        }
        const form = new ActionFormData()
        form.title({ translate: "cw.scform.title" })
        form.button({ translate: "cw.scform.information" })
        form.button({ translate: "cw.scform.member" })
        form.button({ translate: "cw.scform.money" })
        form.button({ translate: "cw.scform.tax" })
        form.button({ translate: "cw.scform.permission" })
        form.button({ translate: "cw.scform.delete" })

        const res = await form.show(player)
        if (res.canceled) return;
        switch (res.selection) {
            case 0:
                Information.information(player, countryData)
                break;

            case 1:
                Member.member(player, countryData)
                break;
            case 2:
                Money.money(player, countryData)
                break;
            case 3:
                Tax.tax(player, countryData)
                break;
            case 4:
                if (hasPermission(player, "permission")) {
                    Permission.permission(player, countryData)
                }

                else if (await noPermission(player)) {
                    this.setting(player, countryData)
                }
                break;

            case 5:
                const newform = new MessageFormData()
                newform.title({ translate: "cw.scform.delete" })
                newform.body({ translate: "cw.scform.delete.check", with: [countryData.name] })
                newform.button1({ translate: "cw.form.yes" })
                newform.button2({ translate: "cw.form.no" })
                const res = await newform.show(player)
                if (res.canceled || res.selection == 1) return;
                this.delete(countryData)
                break
        }
    }




}
class Information {
    static async information(player, countryData) {
        const form = new MessageFormData()
        form.title({ translate: "cw.scform.information" })
        form.body({
            translate: "cw.scform.informations", with: [
                `${countryData.name}`,
                `${countryData.description}`,
                `${playerDatas.get(countryData.owner)?.name || "Unknown"}`,
                `${countryData.players.filter(id => id != countryData.owner).map(id => playerDatas.get(id)?.name || "Unknown").join(", ")}`,
                `${countryData.money}`,
                `${countryData.tax.consumption}`,
                `${countryData.tax.income}`,
                `${countryData.tax.country}`,
                `${countryData.tax.customs}`
            ]
        })
        form.button1({ translate: "cw.form.redo" })
        if (hasPermission(player, "information")) {
            form.button2({ translate: "cw.scform.setting" })
        }
        else {
            form.button2({ translate: "cw.form.cancel" })
        }

        const res = await form.show(player)
        if (res.selection == 0) {
            Country.setting(player, countryData)
        }
        if (res.selection == 1) {

            if (hasPermission(player, "information")) {
                this.edit(player, countryData)
            }
        }

    }
    static async edit(player, countryData) {
        const form = new ModalFormData()
        form.title({ translate: "cw.scform.information" })
        form.textField({ translate: "cw.mcform.WriteCountryNameLabel" }, "Press Name", { defaultValue: countryData.name })//国名
        form.textField({ translate: "cw.scform.information.description" }, "Write Description", { defaultValue: countryData.description })//国名
        const res = await form.show(player)
        if (res.canceled) return;
        countryData.name = res.formValues[0]
        countryData.description = res.formValues[1]
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

        const players = countryData.players.filter(playerId => playerId != player.id && playerId != countryData.owner)
        const playersname = players.map(playerId => playerDatas.get(playerId)?.name || "Unknown")
        if (players.length == 0) {
            const form = new MessageFormData()
            form.title({ translate: "cw.scform.permission.set" })
            form.body({ translate: "cw.scform.permission.set.noplayer" })
            form.button1({ translate: "cw.form.redo" })
            form.button2({ translate: "cw.form.cancel" })
            const res = await form.show(player)
            if (res.canceled) return;
            return;
        }
        const form = new ModalFormData()
        form.title({ translate: "cw.scform.permission.set" })

        form.dropdown({ translate: "cw.form.playerchoise" }, playersname)
        form.dropdown({ translate: "cw.scform.permission.choice" }, Object.keys(countryData.permissions))
        const res = await form.show(player)
        if (res.canceled) return;
        const playerId = players[res.formValues[0]]
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

        const permissionName = res.formValues[0]
        const permissionValues = []
        Data.permissions.forEach((perm, index) => {
            if (res.formValues[index + 1]) {
                permissionValues.push(perm)
            }
        })

        countryData.permissions[permissionName] = permissionValues
        countryDatas.set(countryData.id, countryData)
    }
    static async permissionEdit(player, countryData) {
        const aform = new ActionFormData()
        const permissions = Object.keys(countryData.permissions).filter(permissionName => permissionName != "国王")
        aform.title({ translate: "cw.scform.permission.edit" })
        for (const data of permissions) {
            aform.button({ text: `${data}` })
        }
        const resp = await aform.show(player)
        if (resp.canceled) return;
        const permissionName = permissions[resp.selection]

        const form = new ModalFormData()
        form.title({ translate: "cw.scform.permission.edit" })
        form.toggle({ translate: "cw.scform.permission.edit.delete" }, { defaultValue: false, tooltip: "cw.scform.permission.edit.delete.tooltip" })
        form.textField({ translate: "cw.scform.permission.make.name" }, "Press Name", { defaultValue: permissionName })
        for (const data of Data.permissions) {
            const defaultValue = countryData.permissions[permissionName].includes(data)
            form.toggle({ translate: `cw.scform.permissions.${data}` }, { defaultValue })
        }

        const res = await form.show(player)
        if (res.canceled) return;

        if (res.formValues[0]) {
            // 削除する場合: この権限を持つ全プレイヤーの権限をクリア
            for (const playerId of countryData.players) {
                const pData = playerDatas.get(playerId)
                if (pData.permission === permissionName) {
                    pData.permission = ""
                    playerDatas.set(playerId, pData)
                }
            }
            delete countryData.permissions[permissionName]
        }
        else {
            const newPermissionName = res.formValues[1]
            const permissionValues = []
            Data.permissions.forEach((perm, index) => {
                if (res.formValues[index + 2]) {
                    permissionValues.push(perm)
                }
            })

            // 権限名が変更された場合: この権限を持つ全プレイヤーの権限名を更新
            if (permissionName !== newPermissionName) {
                for (const playerId of countryData.players) {
                    const pData = playerDatas.get(playerId)
                    if (pData.permission === permissionName) {
                        pData.permission = newPermissionName
                        playerDatas.set(playerId, pData)
                    }
                }
                delete countryData.permissions[permissionName]
            }

            countryData.permissions[newPermissionName] = permissionValues
        }
        countryDatas.set(countryData.id, countryData)
    }
    static setPermission(playerId, permissionName) {
        const playerData = playerDatas.get(playerId)
        playerData.permission = permissionName
        playerDatas.set(playerId, playerData)
    }

}
class Member {
    static async member(player, countryData) {
        const form = new ActionFormData()
        form.title({ translate: "cw.scform.member" })
        form.button({ translate: "cw.scform.member.invite" })
        form.button({ translate: "cw.scform.member.kick" })
        const res = await form.show(player)
        if (res.canceled) return;
        if (res.selection == 0) {
            this.invite(player, countryData)
        }
        else if (res.selection == 1) {
            this.kick(player, countryData)
        }

    }
    static async invite(player, countryData) {

        const players = world.getAllPlayers().filter(p => !playerDatas.get(p.id).country)
        if (players.length == 0) {
            const form = new MessageFormData()
            form.title({ translate: "cw.scform.member.invite" })
            form.body({ translate: "cw.form.noplayers" })
            form.button1({ translate: "cw.form.redo" })
            form.button2({ translate: "cw.form.cancel" })
            const res = await form.show(player)
            if (res.canceled) return;
            if (res.selection == 0) {
                this.member(player, countryData)
            }
            return;
        }
        const form = new ModalFormData()
        form.title({ translate: "cw.scform.member.invite" })
        form.dropdown({ translate: "cw.form.playerchoise" }, players.map(player => player.name))
        const res = await form.show(player)
        if (res.canceled) return;
        const playerId = players[res.formValues[0]].id
        const playerData = new ShortPlayerData(playerId)
        const countries = playerData.get("invitecountry") || []
        countries.push(countryData.id)
        playerData.set("invitecountry", countries)
        player.sendMessage({ translate: "cw.scform.member.sendinvite", with: [world.getEntity(playerId).name] })
        world.getEntity(playerId).sendMessage({ translate: "cw.scform.member.invited", with: [countryData.name] })
    }
    static async kick(player, countryData) {
        const form = new ModalFormData()
        form.title({ translate: "cw.scform.member.kick" })
        form.dropdown({ translate: "cw.form.playerchoise" }, countryData.players.map(playerId => playerDatas.get(playerId).name))
        const res = await form.show(player)
        if (res.canceled) return;
        const playerId = countryData.players[res.formValues[0]]
        const playerData = playerDatas.get(playerId)
        playerData.country = undefined
        playerDatas.set(playerId, playerData)
        countryData.players.splice(countryData.players.indexOf(playerId), 1)
        countryDatas.set(countryData.id, countryData)
        player.sendMessage({ translate: "cw.scform.member.kick.success", with: [playerDatas.get(playerId).name] })
        const data = `world.getEntity('${playerId}').sendMessage({ translate: "cw.scform.member.kicked", with: ["${countryData.name}"] })`
        sendDataForPlayers(data, playerId)
    }
}
class Money {
    static async money(player, countryData) {
        const form = new ActionFormData()
        form.title({ translate: "cw.scform.money" })
        form.body({ translate: "cw.scform.money.title", with: [`${playerDatas.get(player.id).money}`, `${countryData.money}`] })
        if (hasPermission(player, "money_deposit")) {
            form.button({ translate: "cw.scform.money.deposit" })
        }
        if (hasPermission(player, "money_withdraw")) {
            form.button({ translate: "cw.scform.money.withdraw" })
        }
        const res = await form.show(player)
        if (res.canceled) return;
        if (res.selection == 0 && hasPermission(player, "money_deposit")) {
            this.deposit(player, countryData)
        }
        else if ((res.selection == 1 && hasPermission(player, "money_withdraw")) || (res.selection == 0 && !hasPermission(player, "money_deposit"))) {
            this.withdraw(player, countryData)
        }
    }
    static async deposit(player, countryData) {
        const playerMoney = playerDatas.get(player.id).money;
        const form = new ModalFormData()
        form.title({ translate: "cw.scform.money.deposit" })
        form.textField({ translate: "cw.scform.money.title", with: [`${playerMoney}`, `${countryData.money}`] }, "Press Number")
        const res = await form.show(player)
        if (res.canceled) return;
        const money = Number(res.formValues[0])
        if (isNaN(money) || money <= 0) return;

        const isEnough = await this.enoughmoney(player, money, "deposit")
        if (isEnough === true) {
            const playerData = playerDatas.get(player.id)
            playerData.money -= money
            playerDatas.set(player.id, playerData)
            countryData.money += money
            countryDatas.set(countryData.id, countryData)
            player.sendMessage({ translate: "cw.scform.money.deposit.success", with: [`${money}`] })
        }
        else if (isEnough === "retry") {
            this.deposit(player, countryData)
        }
    }
    static async withdraw(player, countryData) {
        const playerMoney = playerDatas.get(player.id).money;
        const form = new ModalFormData()
        form.title({ translate: "cw.scform.money.withdraw" })
        form.textField({ translate: "cw.scform.money.title", with: [`${playerMoney}`, `${countryData.money}`] }, "Press Number")
        const res = await form.show(player)
        if (res.canceled) return;
        const money = Number(res.formValues[0])
        if (isNaN(money) || money <= 0) return;

        const isEnough = await this.enoughmoney(player, money, "withdraw")
        if (isEnough === true) {
            const playerData = playerDatas.get(player.id)
            playerData.money += money
            playerDatas.set(player.id, playerData)
            countryData.money -= money
            countryDatas.set(countryData.id, countryData)
            player.sendMessage({ translate: "cw.scform.money.withdraw.success", with: [`${money}`] })
        }
        else if (isEnough === "retry") {
            this.withdraw(player, countryData)
        }
    }
    static async enoughmoney(player, need, type) {
        let current = 0;
        let title = "";
        let body = "";

        if (type == "deposit") {
            current = playerDatas.get(player.id).money;
            title = "cw.scform.money.withdraw";
            body = "cw.scform.money.deposit.noenough"; // Added check for country money
        }
        else if (type == "withdraw") {
            current = countryDatas.get(playerDatas.get(player.id).country).money;
            title = "cw.scform.money.withdraw";
            body = "cw.scform.money.withdraw.countrynomoney"; // Added check for country money
        }


        if (current < need) {
            const form = new MessageFormData()
            form.title({ translate: title })
            form.body({ translate: body })
            form.button1({ translate: "cw.form.redo" })
            form.button2({ translate: "cw.form.cancel" })
            const res = await form.show(player)
            if (res.canceled) return false;
            return res.selection == 0 ? "retry" : false;
        }
        return true;
    }

}
class Tax {
    static async tax(player, countryData) {
        const form = new ModalFormData()
        form.title({ translate: "cw.scform.tax" })
        form.slider({ translate: "cw.scform.tax.consumption" }, 0, 100, { defaultValue: countryData.tax.consumption })
        form.slider({ translate: "cw.scform.tax.income" }, 0, 100, { defaultValue: countryData.tax.income })
        form.slider({ translate: "cw.scform.tax.country" }, 0, 100, { defaultValue: countryData.tax.country })
        form.slider({ translate: "cw.scform.tax.customs" }, 0, 100, { defaultValue: countryData.tax.customs })
        const res = await form.show(player)
        if (res.canceled) return;
        countryData.tax.consumption = res.formValues[0]
        countryData.tax.income = res.formValues[1]
        countryDatas.set(countryData.id, countryData)
        player.sendMessage({ translate: "cw.scform.tax.success", with: [`${countryData.tax.consumption}`] })
    }
}
export function hasPermission(player, permissionName) {
    const playerData = playerDatas.get(player.id)
    if (!playerData.country) return false
    const countryData = countryDatas.get(playerData.country)
    const playerPermission = playerData.permission
    if (!playerPermission || !countryData.permissions[playerPermission]) return false
    return countryData.permissions[playerPermission].includes(permissionName)
}
export async function noPermission(player) {
    const form = new MessageFormData()
    form.title({ translate: "cw.scform.permission" })
    form.body({ translate: "cw.scform.permission.nopermission" })
    form.button1({ translate: "cw.form.redo" })
    form.button2({ translate: "cw.form.cancel" })
    const res = await form.show(player)
    if (res.canceled) return;
    return res.selection == 0
}
