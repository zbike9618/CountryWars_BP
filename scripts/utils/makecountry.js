import * as server from "@minecraft/server"
const { world, system } = server;
import { ActionFormData, ModalFormData, MessageFormData } from "@minecraft/server-ui"
import { Util } from "./util.js";
const countryDatas = new Dypro("country");
export class MakeCountry {

    static makeForm(player) {
        const form = new ModalFormData()
        form.header({ translate: "cw.mcform.header" })

    }
    //constructurはなし
    /**
     * 国を作る
     * @param {import("@minecraft/server").Entity} player 
     * 
     */
    static make(player) {

    }

}