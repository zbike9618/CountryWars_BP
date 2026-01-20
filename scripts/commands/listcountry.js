import * as server from "@minecraft/server"
import { ActionFormData, ModalFormData, MessageFormData } from "@minecraft/server-ui"
const { world, system } = server;
import { Country } from "../utils/country";
import { Dypro } from "../utils/dypro";
const countryDatas = new Dypro("country");
const playerDatas = new Dypro("player");


server.system.beforeEvents.startup.subscribe(ev => {
    ev.customCommandRegistry.registerCommand({
        name: "cw:listcountry",
        description: "国の一覧を表示するコマンド",
        permissionLevel: server.CommandPermissionLevel.Any,
        mandatoryParameters: [
        ],
        optionalParameters: [
        ]
    }, (origin, arg) => {
        if (origin.sourceEntity?.typeId === "minecraft:player") {
            let player = origin.sourceEntity;
            system.run(() => {  // 1tick後に安全に実行
                showCountryList(player);
            });
        }
    });
});
server.system.beforeEvents.startup.subscribe(ev => {
    ev.customCommandRegistry.registerCommand({
        name: "cw:lc",
        description: "国の一覧を表示するコマンド",
        permissionLevel: server.CommandPermissionLevel.Any,
        mandatoryParameters: [
        ],
        optionalParameters: [
        ]
    }, (origin, arg) => {
        if (origin.sourceEntity?.typeId === "minecraft:player") {
            let player = origin.sourceEntity;
            system.run(() => {  // 1tick後に安全に実行
                showCountryList(player);
            });
        }
    });
});

function showCountryList(player) {
    const form = new ActionFormData();
    form.title({ translate: "cw.listcountry.title" });
    if (countryDatas.idList.length === 0) {
        form.body({ translate: "cw.listcountry.nocountry" });
        form.show(player);
        return;
    }
    const countries = countryDatas.idList
        .map(id => countryDatas.get(id))
        .filter(country => country?.name);
    for (const country of countries) {
        form.button(country.name);
    }
    form.show(player).then((response) => {
        if (response.canceled) return;
        const selectedCountry = countries[response.selection];
        information(player, selectedCountry);
    });
}

async function information(player, countryData) {
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
                `${countryData.tax.customs}`
            ]
        })
        form.button({ translate: "cw.listcountry.info.ok" })
        form.show(player).then((res) => {
        if (res.canceled) {
            showCountryList(player)
        }
        if (res.selection === 0) {
            showCountryList(player)
        }
    });
}