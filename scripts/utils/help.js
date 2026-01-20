import * as ui from "@minecraft/server-ui"
import * as server from "@minecraft/server"
import { ActionFormData } from "@minecraft/server-ui"
import { ShortPlayerData } from "./playerData"
import { Dypro } from "./dypro"
const playerDatas = new Dypro("player")

export class Help {
    static async mainForm(player) {
        const form = new ActionFormData()
        form.title({ translate: "cw.help.title" })
        form.button({ translate: "cw.help.howtoplay" })
        form.button({ translate: "cw.help.rules" })
        form.button({ translate: "cw.help.commands" })
        const res = await form.show(player)
        if (res.canceled) return;
        if (res.selection === 0) {
            show_howtoplay(player)
        }
        else if (res.selection === 1) {
            show_rules(player)
        }
        else if (res.selection === 2) {
            show_commands(player)
        }
    }
}
async function show_howtoplay(player) {
    const form = new ActionFormData()
    form.title({ translate: "cw.help.howtoplay" })
    const commands = ["whatisthisgame", "mainguide"]
    for (const command of commands) {
        form.button({ translate: `cw.help.howtoplay.${command}.title` })
    }
    form.show(player).then((res) => {
        if (res.canceled) {
            Help.mainForm(player)
            return;
        }
        const selectedCommand = commands[res.selection];
        showhowtoplayHelp(player, selectedCommand);
    })
}
const helphowtoplayData = {
    "whatisthisgame": { title: "cw.help.howtoplay.whatisthisgame.title", body: "cw.help.howtoplay.whatisthisgame.body" },
    "mainguide": { title: "cw.help.howtoplay.mainguide.title", body: "cw.help.howtoplay.mainguide.body" },
    // 他のコマンドも同様に定義（ここでは例として一部のみ）
};

async function showhowtoplayHelp(player, command) {
    const data = helphowtoplayData[command];
    if (!data) return;
    const newform = new ui.ActionFormData();
    newform.title({ translate: data.title });
    newform.body({ translate: data.body });
    newform.button({ translate: "cw.form.redo" });
    newform.show(player).then((res) => {
        if (res.canceled || res.selection === 0) {
            show_howtoplay(player);
            return;
        }
    });
}






async function show_commands(player) {
    const form = new ActionFormData()
    form.title({ translate: "cw.help.commands" })
    const commands = ["/money", "/bank", "/sethome", "/home", "/jobs", "/tpaccept", "/messagebox", "/countrylist", "/playermarket", "/makecountry", "/settingscountry", "/buychunk", "/sellchunk", "/checkchunk", "/war"]
    for (const command of commands) {
        form.button({ text: command })
    }
    form.show(player).then((res) => {
        if (res.canceled) {
            Help.mainForm(player)
            return;
        }
        const selectedCommand = commands[res.selection];
        showCommandHelp(player, selectedCommand);
    })
}

const helpcommandData = {
    "/money": { title: "cw.help.commands.money.title", body: "cw.help.commands.money.body" },
    "/bank": { title: "cw.help.commands.bank.title", body: "cw.help.commands.bank.body" },
    "/sethome": { title: "cw.help.commands.sethome.title", body: "cw.help.commands.sethome.body" },
    "/home": { title: "cw.help.commands.home.title", body: "cw.help.commands.home.body" },
    "/jobs": { title: "cw.help.commands.jobs.title", body: "cw.help.commands.jobs.body" },
    "/tpaccept": { title: "cw.help.commands.tpaccept.title", body: "cw.help.commands.tpaccept.body" },
    "/messagebox": { title: "cw.help.commands.messagebox.title", body: "cw.help.commands.messagebox.body" },
    "/countrylist": { title: "cw.help.commands.countrylist.title", body: "cw.help.commands.countrylist.body" },
    "/playermarket": { title: "cw.help.commands.playermarket.title", body: "cw.help.commands.playermarket.body" },
    "/makecountry": { title: "cw.help.commands.makecountry.title", body: "cw.help.commands.makecountry.body" },
    "/settingscountry": { title: "cw.help.commands.settingscountry.title", body: "cw.help.commands.settingscountry.body" },
    "buychunk": { title: "cw.help.commands.buychunk.title", body: "cw.help.commands.buychunk.body" },
    "/sellchunk": { title: "cw.help.commands.sellchunk.title", body: "cw.help.commands.sellchunk.body" },
    "checkchunk": { title: "cw.help.commands.checkchunk.title", body: "cw.help.commands.checkchunk.body" },
    "/war": { title: "cw.help.commands.war.title", body: "cw.help.commands.war.body" },
    // 他のコマンドも同様に定義（ここでは例として一部のみ）
};

async function showCommandHelp(player, command) {
    const data = helpcommandData[command];
    if (!data) return;
    const newform = new ui.ActionFormData();
    newform.title({ translate: data.title });
    newform.body({ translate: data.body });
    newform.button({ translate: "cw.form.redo" });
    newform.show(player).then((res) => {
        if (res.canceled || res.selection === 0) {
            show_commands(player);
            return;
        }
    });
}