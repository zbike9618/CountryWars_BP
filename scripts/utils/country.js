import * as server from "@minecraft/server"
const { world, system } = server;
import { ActionFormData, ModalFormData, MessageFormData } from "@minecraft/server-ui"
import { ChestFormData } from "./chest_shop/chest-ui.js";
import { Util } from "./util.js";
import { Dypro } from "./dypro.js";
const countryDatas = new Dypro("country");
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
            PlayerPermission: { "国王": [player.id] },
            permissions: { "国王": [] },
            //同盟国などはあとで

        }
        countryDatas.set(id, countryData);
    }
    static delete(countryData) {
        countryDatas.delete(countryData.id);
    }
    static async setting(player, countryData) {
        const form = new ActionFormData()
        form.title({ translate: "cw.scform.title" })
        form.button({ translate: "cw.scform.information" })
        form.button({ translate: "cw.scform.tax" })
        form.button({ translate: "cw.scform.permission" })
        form.button({ translate: "cw.scform.delete" })

        const res = await form.show(player)
        if (res.canceled) return;
        if (res.selection == 0) {
            this.information(player, countryData)
        }
        if (res.selection == 1) {
            this.tax(countryData)
        }
        if (res.selection == 2) {
            this.permission(countryData)
        }
        if (res.selection == 3) {
            this.delete(countryData)
        }
    }
    static async information(player, countryData) {


    }

}