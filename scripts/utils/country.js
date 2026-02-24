import * as server from "@minecraft/server"
const { world, system } = server;
import { ActionFormData, ModalFormData, MessageFormData } from "@minecraft/server-ui"
import { DiscordRelay } from "./chat.js";
import { ChestFormData } from "./chest_shop/chest-ui";
import { Util } from "./util";
import { Dypro } from "./dypro";
import { Data } from "./data";
import { ShortPlayerData } from "./playerData";
import { sendDataForPlayers } from "./sendData";
import { War } from "./war";
import config from "../config/config.js";
const countryDatas = new Dypro("country");
const playerDatas = new Dypro("player");
const chunkDatas = new Dypro("chunk");
export class Country {

    static async makeForm(player) {
        const playerData = playerDatas.get(player.id);
        if (playerData.country) {
            player.sendMessage({ translate: "cw.mcform.alreadyCountry" })
            return;
        }

        // 建国費用のチェック
        if (playerData.money < config.countryprice) {
            player.sendMessage(`§c建国には§e${config.countryprice}§c必要です。現在の手持ち: §e${playerData.money}`);
            return;
        }

        const form = new ModalFormData()
        form.title({ translate: "cw.mcform.title" })
        form.textField({ translate: "cw.mcform.WriteCountryNameLabel" }, { translate: "cw.mcform.WriteCountryNamePlaceholder" })//国名
        form.toggle({ translate: "cw.mcform.toggle" }, { defaultValue: false, tooltip: { translate: "cw.mcform.toggleTooltip" } })//平和主義か

        const res = await form.show(player)
        if (res.canceled) return;
        if (countryDatas.idList.map(id => countryDatas.get(id)?.name).includes(res.formValues[0])) {
            player.sendMessage({ translate: "cw.mcform.countryalreadyexists" })
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
        const ids = countryDatas.idList.map(id => Number(id));
        const id = (ids.length > 0 ? Math.max(...ids) : 0) + 1;
        const countryData =
        {
            id,
            name: countryName,
            description: "",
            money: 0,
            tax: {
                consumption: 0,//消費税
                income: 0,//所得税
                country: 0,//国民税
                customs: 0//関税
            },//税率[%]
            isPeace: isPeace,
            owner: player.id,
            players: [player.id],
            permissions: { "国王": Data.permissions },
            chunkAmount: 0,
            buildtime: Date.now(),
            lastDefeated: 0,
            robbedChunkAmount: [],//国ごとに保存
            wardeath: 0,//戦争中に死んでいい回数
            warcountry: [],//戦争中
            peaceProposals: {},//講和提案
            stock: [{ price: 10, date: Date.now() }],//株
            diplomacy: {
                ally: [], // 同盟国 (相互承諾)
                friend: [], // 友好国 (一方的)
                neutral: [], // 中立国 (デフォルト)
                enemy: [], // 敵対国 (一方的)
                requests: [] // 同盟申請受信リスト
            },
            diplomacyPermissions: { // 外交関係ごとの権限設定
                ally: [],
                friend: [],
                neutral: [],
                enemy: []
            }


        }
        countryDatas.set(id, countryData);

        // 建国費用の支払い
        Util.addMoney(player, -config.countryprice);

        const playerData = playerDatas.get(player.id);
        playerData.country = id;
        playerData.permission = "国王";
        playerDatas.set(player.id, playerData);
        // tellrawを使うことでWebSocketがイベントとして検知できるようになります
        const countryName_2 = countryData.name;
        world.getDimension("overworld").runCommand(`tellraw @a {"rawtext":[{"translate":"cw.mcform.createMessage","with":["${countryName_2}"]}]}`);
        DiscordRelay.sendTranslate("cw.mcform.createMessage", [countryName_2]);

    }
    static delete(countryData) {
        const players = countryData.players;
        for (const playerId of players) {
            const playerData = playerDatas.get(playerId);
            playerData.country = undefined;
            playerData.permission = "";
            playerDatas.set(playerId, playerData);
        }
        //戦争中なら戦争を終わらせる
        if (countryData.warcountry.length > 0) {
            for (const warcountryId of countryData.warcountry) {
                const warcountryData = countryDatas.get(warcountryId);
                if (!warcountryData) continue;
                War.finish(warcountryData, countryData, "invade");
            }
        }
        //chunkも消す
        const chunkIds = chunkDatas.idList;
        for (const chunkId of chunkIds) {
            const chunkData = chunkDatas.get(chunkId);
            if (chunkData && chunkData.country === countryData.id) {
                chunkDatas.delete(chunkId);
            }
        }
        //同盟関係も消す
        const deletedCountryId = countryData.id;
        for (const countryId of countryDatas.idList) {
            const currentCountryData = countryDatas.get(countryId);
            if (currentCountryData && currentCountryData.diplomacy && currentCountryData.diplomacy.ally && currentCountryData.diplomacy.ally.includes(deletedCountryId)) {
                currentCountryData.diplomacy.ally.splice(currentCountryData.diplomacy.ally.indexOf(deletedCountryId), 1);
                countryDatas.set(countryId, currentCountryData);
            }
        }
        //国庫の50%を国王に、残りの50%を国民に分配する
        const kingData = playerDatas.get(countryData.owner);
        kingData.money += Math.floor(countryData.money * 0.5);
        playerDatas.set(countryData.owner, kingData);
        for (const playerId of players) {
            const playerData = playerDatas.get(playerId);
            playerData.money += Math.floor(countryData.money * 0.5 / players.length);
            playerDatas.set(playerId, playerData);
        }
        //株も消す
        for (const playerId of playerDatas.idList) {
            const pData = playerDatas.get(playerId);
            if (pData.stock && pData.stock[countryData.id]) {
                delete pData.stock[countryData.id];
                playerDatas.set(playerId, pData);
            }
        }
        countryDatas.delete(countryData.id);
        // tellrawを使うことでWebSocketがイベントとして検知できるようになります
        const countryName_3 = countryData.name;
        world.getDimension("overworld").runCommand(`tellraw @a {"rawtext":[{"translate":"cw.scform.deleteMessage","with":["${countryName_3}"]}]}`);
        DiscordRelay.sendTranslate("cw.scform.deleteMessage", [countryName_3]);
    }
    static join(player, countryData) {
        const playerData = playerDatas.get(player.id);
        if (playerData.country) {
            player.sendMessage({ translate: "cw.mcform.alreadyCountry" })
            return false;
        }
        playerData.country = countryData.id;
        playerDatas.set(player.id, playerData);
        countryData.players.push(player.id);
        countryDatas.set(countryData.id, countryData);
        for (const p of Util.GetCountryPlayer(countryData)) {
            const data = `world.getEntity(${p.id}).sendMessage({ translate: "cw.mcform.joinMessage", with: [${countryData.name}] })`
            sendDataForPlayers(data, player.id)
        }
        return true;
    }
    static exit(player, countryData) {
        const playerData = playerDatas.get(player.id);
        if (!playerData.country) {
            player.sendMessage({ translate: "cw.form.unjoincountry" })
            return false;
        }
        playerData.country = undefined;
        playerDatas.set(player.id, playerData);
        countryData.players.splice(countryData.players.indexOf(player.id), 1);
        countryDatas.set(countryData.id, countryData);
        for (const p of Util.GetCountryPlayer(countryData)) {
            const data = `world.getEntity(${p.id}).sendMessage({ translate: "cw.mcform.exitMessage", with: [${countryData.name}] })`
            sendDataForPlayers(data, player.id)
        }
        return true;
    }
    static async setting(player, countryData) {
        if (countryData == "none") {
            player.sendMessage({ translate: "cw.form.unjoincountry" })
            return;
        }
        const form = new ActionFormData()
        form.title({ translate: "cw.scform.title" })
        const actions = [];

        form.button({ translate: "cw.scform.information" })
        actions.push(() => Information.information(player, countryData));

        form.button({ translate: "cw.scform.member" })
        actions.push(() => Member.member(player, countryData));

        form.button({ translate: "cw.scform.money" })
        actions.push(() => Money.money(player, countryData));

        form.button({ translate: "cw.scform.tax" })
        actions.push(async () => {
            if (hasPermission(player, "tax_manage")) {
                Tax.tax(player, countryData)
            } else if (await noPermission(player)) {
                this.setting(player, countryData)
            }
        });

        form.button({ translate: "cw.scform.permission" })
        actions.push(async () => {
            if (hasPermission(player, "permission")) {
                Permission.permission(player, countryData)
            } else if (await noPermission(player)) {
                this.setting(player, countryData)
            }
        });

        form.button({ translate: "cw.scform.diplomacy" })
        actions.push(async () => {
            if (hasPermission(player, "diplomacy")) {
                Diplomacy.diplomacy(player, countryData)
            } else if (await noPermission(player)) {
                this.setting(player, countryData)
            }
        });

        // 戦争保護解除ボタン (国王のみ、かつ保護中)
        if (War.isProtected(countryData) && player.id === countryData.owner) {
            form.button({ translate: "cw.scform.protection.cancel" });
            actions.push(() => War.cancelProtectionForm(player, countryData));
        }

        if (player.id === countryData.owner) {
            form.button({ translate: "cw.scform.delete" })
            actions.push(async () => {
                const deleteCheckForm = new MessageFormData()
                deleteCheckForm.title({ translate: "cw.scform.delete" })
                deleteCheckForm.body({ translate: "cw.scform.delete.check", with: [countryData.name] })
                deleteCheckForm.button1({ translate: "cw.form.yes" })
                deleteCheckForm.button2({ translate: "cw.form.no" })
                const delRes = await deleteCheckForm.show(player)
                if (delRes.canceled || delRes.selection == 1) return;
                this.delete(countryData)
            });
        } else {
            form.button({ translate: "cw.scform.exit" })
            actions.push(async () => {
                const exitCheckForm = new MessageFormData()
                exitCheckForm.title({ translate: "cw.scform.exit" })
                exitCheckForm.body({ translate: "cw.scform.exit.check", with: [countryData.name] })
                exitCheckForm.button1({ translate: "cw.form.yes" })
                exitCheckForm.button2({ translate: "cw.form.no" })
                const exitRes = await exitCheckForm.show(player)
                if (exitRes.canceled || exitRes.selection == 1) return;
                this.exit(player, countryData)
            });
        }

        const res = await form.show(player)
        if (res.canceled) return;
        actions[res.selection]();
    }




}
class Information {
    static async information(player, countryData) {
        const form = new ActionFormData()
        form.title({ translate: "cw.scform.information" })
        form.body({
            translate: "cw.scform.informations", with: [
                `${countryData.name}`,
                `${countryData.description}`,
                `${playerDatas.get(countryData.owner)?.name || "Unknown"}`,
                `${countryData.players.filter(id => id != countryData.owner).map(id => playerDatas.get(id)?.name || "Unknown").join(", ")}`,
                `${countryData.money}`,
                `${countryData.chunkAmount}`,
                `${countryData.tax.consumption}`,
                `${countryData.tax.income}`,
                `${countryData.tax.country}`,
                `${countryData.tax.customs}`,
                War.isProtected(countryData) ? Util.formatTime(countryData.buildtime + (config.warProtectionPeriod * 24 * 60 * 60 * 1000) - Date.now()) : "§7なし"
            ]
        })
        form.button({ translate: "cw.form.redo" })
        if (hasPermission(player, "information")) {
            form.button({ translate: "cw.scform.setting" })
        }

        const res = await form.show(player)
        if (res.selection == 0) {
            Country.setting(player, countryData)
        }
        if (res.selection == 1) {
            this.edit(player, countryData)

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
        const actions = [];

        if (hasPermission(player, "member_invite")) {
            form.button({ translate: "cw.scform.member.invite" })
            actions.push(() => this.invite(player, countryData));
        }
        if (hasPermission(player, "member_kick")) {
            form.button({ translate: "cw.scform.member.kick" })
            actions.push(() => this.kick(player, countryData));
        }
        // 国王のみ譲位が可能
        if (player.id === countryData.owner) {
            form.button({ translate: "cw.scform.member.transfer" })
            actions.push(() => this.transferOwner(player, countryData));
        }

        const res = await form.show(player)
        if (res.canceled) return;
        if (actions[res.selection]) actions[res.selection]();
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

        const players = countryData.players.filter(id => id !== countryData.owner)
        if (players.length == 0) {
            const form = new MessageFormData()
            form.title({ translate: "cw.scform.member.kick" })
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
        form.title({ translate: "cw.scform.member.kick" })
        form.dropdown({ translate: "cw.form.playerchoise" }, players.map(playerId => playerDatas.get(playerId).name))
        const res = await form.show(player)
        if (res.canceled) return;
        const playerId = players[res.formValues[0]]
        const playerData = playerDatas.get(playerId)
        playerData.country = undefined
        playerData.permission = ""
        playerDatas.set(playerId, playerData)
        countryData.players.splice(countryData.players.indexOf(playerId), 1)
        countryDatas.set(countryData.id, countryData)
        player.sendMessage({ translate: "cw.scform.member.kick.success", with: [playerDatas.get(playerId).name] })
        const data = `world.getEntity('${playerId}').sendMessage({ translate: "cw.scform.member.kicked", with: ["${countryData.name}"] })`
        sendDataForPlayers(data, playerId)
    }
    static async transferOwner(player, countryData) {
        const members = countryData.players.filter(id => id !== player.id);
        if (members.length === 0) {
            player.sendMessage({ translate: "cw.form.noplayers" });
            return;
        }

        const form = new ModalFormData();
        form.title({ translate: "cw.scform.member.transfer.title" });
        form.dropdown({ translate: "cw.scform.member.transfer.select" }, members.map(id => playerDatas.get(id)?.name || "Unknown"));

        const res = await form.show(player);
        if (res.canceled) return;

        const newOwnerId = members[res.formValues[0]];
        const newOwnerName = playerDatas.get(newOwnerId)?.name || "Unknown";

        const confirmForm = new MessageFormData();
        confirmForm.title({ translate: "cw.scform.member.transfer.title" });
        confirmForm.body({ translate: "cw.scform.member.transfer.confirm", with: [newOwnerName] });
        confirmForm.button1({ translate: "cw.form.yes" });
        confirmForm.button2({ translate: "cw.form.no" });

        const confirmRes = await confirmForm.show(player);
        if (confirmRes.canceled || confirmRes.selection === 1) return;

        // 譲位処理
        const oldOwnerData = playerDatas.get(player.id);
        const newOwnerData = playerDatas.get(newOwnerId);

        oldOwnerData.permission = ""; // 旧国王は権限なしに
        newOwnerData.permission = "国王"; // 新国王に国王権限

        countryData.owner = newOwnerId;

        playerDatas.set(player.id, oldOwnerData);
        playerDatas.set(newOwnerId, newOwnerData);
        countryDatas.set(countryData.id, countryData);

        player.sendMessage({ translate: "cw.scform.member.transfer.success", with: [newOwnerName] });
        world.sendMessage({ translate: "cw.scform.member.transfer.announced", with: [countryData.name, newOwnerName] });
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
        const money = Math.floor(Number(res.formValues[0]));
        if (isNaN(money) || money <= 0 || !Number.isFinite(money)) return;

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
        const money = Math.floor(Number(res.formValues[0]));
        if (isNaN(money) || money <= 0 || !Number.isFinite(money)) return;

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
        countryData.tax.country = res.formValues[2]
        countryData.tax.customs = res.formValues[3]
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

class Diplomacy {
    // 外交権限のリスト
    static permissions = [
        "break_block", // ブロック破壊
        "place_block", // ブロック設置
        "interact", // ブロック/エンティティへの干渉
        "attack_player", // プレイヤーへの攻撃
        "attack_entity" // エンティティへの攻撃
    ];

    static relationJP = {
        "ally": "同盟",
        "friend": "友好",
        "neutral": "中立",
        "enemy": "敵対"
    };

    /**
     * 外交関連のメインメニュー
     */
    static async diplomacy(player, countryData) {
        const form = new ActionFormData();
        form.title({ translate: "cw.scform.diplomacy" });
        form.button({ translate: "cw.scform.diplomacy.list" }); // 関係一覧
        form.button({ translate: "cw.scform.diplomacy.change" }); // 関係変更
        form.button({ translate: "cw.scform.diplomacy.requests" }); // 同盟申請確認
        // 申請数が0より大きければバッジを表示したいが、ActionFormDataでは無理なのでテキストで表現
        if (countryData.diplomacy.requests && countryData.diplomacy.requests.length > 0) {
            form.body({ translate: "cw.scform.diplomacy.request_pending", with: [`${countryData.diplomacy.requests.length}`] });
        }
        form.button({ translate: "cw.scform.diplomacy.permission" }); // 外交権限設定

        const res = await form.show(player);
        if (res.canceled) return;

        switch (res.selection) {
            case 0:
                this.list(player, countryData);
                break;
            case 1:
                this.changeRelationMenu(player, countryData);
                break;
            case 2:
                this.checkRequests(player, countryData);
                break;
            case 3:
                this.permissionMenu(player, countryData);
                break;
        }
    }

    /**
     * 外交関係一覧表示
     */
    static async list(player, countryData) {
        const form = new ActionFormData();
        form.title({ translate: "cw.scform.diplomacy.list" });

        const relations = ["ally", "friend", "neutral", "enemy"];
        let bodyText = "";

        for (const rel of relations) {
            const countryIds = countryData.diplomacy[rel];
            let names = "";
            if (countryIds && countryIds.length > 0) {
                names = countryIds.map(id => {
                    const c = countryDatas.get(id);
                    return c ? c.name : `Unknown(${id})`;
                }).join(", ");
            } else {
                names = "None"; // 翻訳キーがあれば変更
            }
            bodyText += `§l${this.relationJP[rel]}§r: ${names}\n`;
        }

        form.body(bodyText);
        form.button({ translate: "cw.form.redo" });

        await form.show(player);
        this.diplomacy(player, countryData);
    }

    /**
     * 関係変更メニュー（国選択）
     */
    static async changeRelationMenu(player, countryData) {
        // 全ての他の国を取得
        const allCountries = countryDatas.idList
            .filter(id => id != countryData.id) // 自分以外
            .map(id => countryDatas.get(id))
            .filter(c => c); // undefined除外

        if (allCountries.length === 0) {
            player.sendMessage({ translate: "cw.scform.diplomacy.nocountries" });
            return;
        }

        const form = new ModalFormData();
        form.title({ translate: "cw.scform.diplomacy.change" });
        form.dropdown({ translate: "cw.scform.diplomacy.select_country" }, allCountries.map(c => c.name));

        const res = await form.show(player);
        if (res.canceled) return;

        const targetCountryStr = allCountries[res.formValues[0]];
        // データを再取得して整合性を保つ
        const targetCountry = countryDatas.get(targetCountryStr.id);

        if (!targetCountry) {
            player.sendMessage({ translate: "cw.error.country_not_found" });
            return;
        }

        this.selectRelationAction(player, countryData, targetCountry);
    }

    /**
     * 特定の国との関係アクション選択
     */
    static async selectRelationAction(player, countryData, targetCountry) {
        // 現在の関係を確認
        let currentRelation = "neutral";
        if (countryData.diplomacy.ally.includes(targetCountry.id)) currentRelation = "ally";
        else if (countryData.diplomacy.friend.includes(targetCountry.id)) currentRelation = "friend";
        else if (countryData.diplomacy.enemy.includes(targetCountry.id)) currentRelation = "enemy";

        const form = new ActionFormData();
        form.title({ translate: "cw.scform.diplomacy.action", with: [targetCountry.name] });
        form.body({ translate: "cw.scform.diplomacy.current_relation", with: [this.relationJP[currentRelation]] });

        // アクションボタン
        form.button({ translate: "cw.scform.diplomacy.req_ally" }); // 同盟申請
        form.button({ translate: "cw.scform.diplomacy.set_friend" }); // 友好国に設定
        form.button({ translate: "cw.scform.diplomacy.set_neutral" }); // 中立国に設定
        form.button({ translate: "cw.scform.diplomacy.set_enemy" }); // 敵対国に設定

        const res = await form.show(player);
        if (res.canceled) return;

        switch (res.selection) {
            case 0:
                this.requestAlly(player, countryData, targetCountry);
                break;
            case 1:
                this.setRelation(player, countryData, targetCountry, "friend");
                break;
            case 2:
                this.setRelation(player, countryData, targetCountry, "neutral");
                break;
            case 3:
                this.setRelation(player, countryData, targetCountry, "enemy");
                break;
        }
    }

    /**
     * 同盟申請
     */
    static requestAlly(player, countryData, targetCountry) {
        if (!targetCountry.diplomacy) {
            player.sendMessage({ rawtext: [{ text: "§cThe target country does not support diplomacy yet. (Old Data)" }] });
            return;
        }
        // 既に同盟なら中止
        if (countryData.diplomacy.ally.includes(targetCountry.id)) {
            player.sendMessage({ translate: "cw.scform.diplomacy.already_ally" });
            return;
        }
        // 既に申請済みかチェック
        if (targetCountry.diplomacy.requests.includes(countryData.id)) {
            player.sendMessage({ translate: "cw.scform.diplomacy.already_requested" });
            return;
        }

        targetCountry.diplomacy.requests.push(countryData.id);
        countryDatas.set(targetCountry.id, targetCountry);

        player.sendMessage({ translate: "cw.scform.diplomacy.request_sent", with: [targetCountry.name] });

        // 相手国のオーナーに通知
        const ownerId = targetCountry.owner;
        const msg = `world.getEntity('${ownerId}').sendMessage({ translate: "cw.scform.diplomacy.receive_request", with: ["${countryData.name}"] })`;
        sendDataForPlayers(msg, ownerId);
    }

    /**
     * 関係設定 (Friendly, Neutral, Enemy)
     * 一方的に設定可能
     */
    static setRelation(player, countryData, targetCountry, newRelation) {
        const targetId = targetCountry.id;

        // 現在の関係から削除
        const relations = ["ally", "friend", "neutral", "enemy"];
        relations.forEach(rel => {
            const idx = countryData.diplomacy[rel].indexOf(targetId);
            if (idx !== -1) {
                countryData.diplomacy[rel].splice(idx, 1);
            }
        });

        // 相互承諾が必要な同盟を一方的に破棄する場合の処理も上記でカバーされる
        // ただし、相手側のリストからも削除するか？
        // 友好・敵対は「自国が相手をどう思っているか」なので、相手のリストはいじらないのが基本だが、
        // 「同盟」だけは双方向データの整合性が必要。
        // もし元が同盟だったなら、相手の同盟リストからも自分を消す必要がある。

        // ここで再取得しないとデータが古い可能性があるが、countryDataはこの関数のローカル変数なので、
        // setRelationの前にリフレッシュされている前提、またはここで相手のデータを取得。

        // 相手側の同盟リストから自分を削除する処理 (もし元が同盟だったら)
        // 相手データ取得
        const freshTargetData = countryDatas.get(targetId);
        if (freshTargetData && freshTargetData.diplomacy && freshTargetData.diplomacy.ally) {
            const allyIdx = freshTargetData.diplomacy.ally.indexOf(countryData.id);
            if (allyIdx !== -1) {
                // 向こうも同盟だった -> 同盟解消通知
                freshTargetData.diplomacy.ally.splice(allyIdx, 1);
                // 向こうは自動的に中立(リストにない状態)になるか、明示的にneutralに入れるか。
                // 初期化構造では neutral: [] だが、neutralは「他のリストにない」状態とみなすことも多い。
                // ただ、country.jsの初期データ構造には neutral: [] があるので、一応入れておく？
                // しかし、get時は neutral 配列を見る実装をしているなら入れる必要がある。
                // ここでは「中立」明示リストに入れる。
                freshTargetData.diplomacy.neutral.push(countryData.id);
                countryDatas.set(freshTargetData.id, freshTargetData);

                const msg = `world.getEntity('${freshTargetData.owner}').sendMessage({ translate: "cw.scform.diplomacy.ally_broken", with: ["${countryData.name}"] })`;
                sendDataForPlayers(msg, freshTargetData.owner);
            }
        }

        // 新しい関係に追加 (neutral以外)
        if (newRelation !== "neutral") {
            countryData.diplomacy[newRelation].push(targetId);
        } else {
            // neutralなら明示的にリストに入れる (構造定義に従う)
            countryData.diplomacy.neutral.push(targetId);
        }

        countryDatas.set(countryData.id, countryData);
        player.sendMessage({ translate: "cw.scform.diplomacy.relation_updated", with: [targetCountry.name, this.relationJP[newRelation]] });
    }

    /**
     * 申請確認メニュー
     */
    static async checkRequests(player, countryData) {
        const requests = countryData.diplomacy.requests;
        if (requests.length === 0) {
            player.sendMessage({ translate: "cw.scform.diplomacy.no_requests" });
            return;
        }

        const requesterNames = requests.map(id => {
            const c = countryDatas.get(id);
            return c ? c.name : `Unknown(${id})`;
        });

        const form = new ActionFormData();
        form.title({ translate: "cw.scform.diplomacy.requests" });
        requesterNames.forEach(name => {
            form.button(name);
        });

        const res = await form.show(player);
        if (res.canceled) return;

        const targetId = requests[res.selection];
        const targetCountry = countryDatas.get(targetId);

        if (!targetCountry) {
            // 国がない場合、申請リストから削除
            requests.splice(res.selection, 1);
            countryDatas.set(countryData.id, countryData);
            return;
        }

        this.handleRequest(player, countryData, targetCountry);
    }

    /**
     * 個別申請の処理 (承諾/拒否)
     */
    static async handleRequest(player, countryData, requesterCountry) {
        const form = new MessageFormData();
        form.title({ translate: "cw.scform.diplomacy.request_handle" });
        form.body({ translate: "cw.scform.diplomacy.request_body", with: [requesterCountry.name] });
        form.button1({ translate: "cw.scform.diplomacy.accept" });
        form.button2({ translate: "cw.scform.diplomacy.deny" });

        const res = await form.show(player);
        if (res.canceled) return;

        // 申請リストから削除
        const reqIdx = countryData.diplomacy.requests.indexOf(requesterCountry.id);
        if (reqIdx !== -1) countryData.diplomacy.requests.splice(reqIdx, 1);

        if (res.selection === 0) { // Accept
            // 自分側: 各リストから削除して ally に追加
            ["friend", "neutral", "enemy"].forEach(rel => {
                const idx = countryData.diplomacy[rel].indexOf(requesterCountry.id);
                if (idx !== -1) countryData.diplomacy[rel].splice(idx, 1);
            });
            countryData.diplomacy.ally.push(requesterCountry.id);

            // 相手側: 各リストから削除して ally に追加
            // 再取得 (整合性)
            let freshRequester = countryDatas.get(requesterCountry.id);
            ["friend", "neutral", "enemy"].forEach(rel => {
                const idx = freshRequester.diplomacy[rel].indexOf(countryData.id);
                if (idx !== -1) freshRequester.diplomacy[rel].splice(idx, 1);
            });
            freshRequester.diplomacy.ally.push(countryData.id);
            countryDatas.set(freshRequester.id, freshRequester);

            player.sendMessage({ translate: "cw.scform.diplomacy.accepted", with: [requesterCountry.name] });
            const msg = `world.getEntity('${freshRequester.owner}').sendMessage({ translate: "cw.scform.diplomacy.request_accepted", with: ["${countryData.name}"] })`;
            sendDataForPlayers(msg, freshRequester.owner);

        } else { // Deny
            player.sendMessage({ translate: "cw.scform.diplomacy.denied", with: [requesterCountry.name] });
            const msg = `world.getEntity('${requesterCountry.owner}').sendMessage({ translate: "cw.scform.diplomacy.request_denied", with: ["${countryData.name}"] })`;
            sendDataForPlayers(msg, requesterCountry.owner);
        }

        countryDatas.set(countryData.id, countryData);
    }

    /**
     * 外交権限設定メニュー (Ally, Friend, Neutral, Enemy ごとに設定)
     */
    static async permissionMenu(player, countryData) {
        const form = new ActionFormData();
        form.title({ translate: "cw.scform.diplomacy.permission_settings" });
        form.button(`${this.relationJP["ally"]} 権限`);
        form.button(`${this.relationJP["friend"]} 権限`);
        form.button(`${this.relationJP["neutral"]} 権限`);
        form.button(`${this.relationJP["enemy"]} 権限`);

        const res = await form.show(player);
        if (res.canceled) return;

        const relations = ["ally", "friend", "neutral", "enemy"];
        const selectedRel = relations[res.selection];

        this.editPermissions(player, countryData, selectedRel);
    }

    /**
     * 権限編集画面
     */
    static async editPermissions(player, countryData, relation) {
        const form = new ModalFormData();
        form.title({ translate: "cw.scform.diplomacy.edit_perm", with: [this.relationJP[relation]] });

        // 現在の設定
        const currentPerms = countryData.diplomacyPermissions[relation] || [];

        this.permissions.forEach(perm => {
            const isEnabled = currentPerms.includes(perm);
            form.toggle({ translate: `cw.diplomacy.perm.${perm}` }, { defaultValue: isEnabled });
        });

        const res = await form.show(player);
        if (res.canceled) return;

        const newPerms = [];
        this.permissions.forEach((perm, index) => {
            if (res.formValues[index]) {
                newPerms.push(perm);
            }
        });

        countryData.diplomacyPermissions[relation] = newPerms;
        countryDatas.set(countryData.id, countryData);

        player.sendMessage({ translate: "cw.scform.diplomacy.perm_updated", with: [relation.toUpperCase()] });
    }
}