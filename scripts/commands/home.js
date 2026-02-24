import * as server from "@minecraft/server"
const { world, system } = server;
import { ActionFormData, MessageFormData, ModalFormData } from "@minecraft/server-ui";
import { Util } from "../utils/util";
import config from "../config/config";
// --- Helpers ---
function getHomes(player) {
    const data = player.getDynamicProperty("homes");
    if (!data) return [];
    try {
        return JSON.parse(data);
    } catch (e) {
        return [];
    }
}

function saveHomes(player, homes) {
    player.setDynamicProperty("homes", JSON.stringify(homes));
}

system.beforeEvents.startup.subscribe(ev => {
    ev.customCommandRegistry.registerCommand({
        name: "cw:sethome",
        description: "ホームを設定・管理する",
        permissionLevel: server.CommandPermissionLevel.Any,
    }, (origin) => {
        if (origin.sourceEntity?.typeId === "minecraft:player") {
            const player = origin.sourceEntity;
            system.run(() => Sethome(player));
        }
    });

    ev.customCommandRegistry.registerCommand({
        name: "cw:home",
        description: "ホームに移動する",
        permissionLevel: server.CommandPermissionLevel.Any,
    }, (origin) => {
        if (origin.sourceEntity?.typeId === "minecraft:player") {
            const player = origin.sourceEntity;
            system.run(() => home(player));
        }
    });
});

async function Sethome(player) {
    const form = new ActionFormData();
    form.title({ translate: "cw.home.set.title" });
    form.button({ translate: "cw.home.menu.add" }); // "ホームを追加"
    form.button({ translate: "cw.home.menu.update" }); // "位置を上書き/更新"
    form.button({ translate: "cw.home.menu.delete" }); // "ホームを削除"

    const res = await form.show(player);
    if (res.canceled) return;

    if (res.selection === 0) {
        // --- Add Home ---
        const modal = new ModalFormData();
        modal.title({ translate: "cw.home.set.title" });
        modal.textField({ translate: "cw.home.set.name" }, "Name");
        const modalRes = await modal.show(player);
        if (modalRes.canceled || !modalRes.formValues[0]) return;

        const name = modalRes.formValues[0];
        let homes = getHomes(player);

        if (homes.find(h => h.name === name)) {
            const confirm = new MessageFormData();
            confirm.title({ translate: "cw.home.set" });
            confirm.body({ translate: "cw.home.set.edit", with: [name] });
            confirm.button1({ translate: "cw.form.overwrite" });
            confirm.button2({ translate: "cw.form.cancel" });
            const confirmRes = await confirm.show(player);
            if (confirmRes.canceled || confirmRes.selection === 1) return;

            // Remove existing by name before re-adding
            homes = homes.filter(h => h.name !== name);
        }

        if (homes.length >= config.maxhome) {
            player.sendMessage({ translate: "cw.home.set.max", with: [`${config.maxhome}`] });
            return;
        }

        homes.push({
            name: name,
            pos: {
                x: Math.floor(player.location.x),
                y: Math.floor(player.location.y),
                z: Math.floor(player.location.z)
            },
            dimension: player.dimension.id
        });
        saveHomes(player, homes);
        player.sendMessage({
            translate: "cw.home.set.success",
            with: [name, `${Math.floor(player.location.x)}`, `${Math.floor(player.location.y)}`, `${Math.floor(player.location.z)}`]
        });

    } else if (res.selection === 1) {
        // --- Update Position (Overwrite) ---
        const homes = getHomes(player);
        if (homes.length === 0) {
            player.sendMessage({ translate: "cw.home.tp.nohome" });
            return;
        }

        const modal = new ModalFormData();
        modal.title({ translate: "cw.home.menu.update" });
        modal.dropdown({ translate: "cw.home.tp.dropdown" }, homes.map(h => h.name));
        const modalRes = await modal.show(player);
        if (modalRes.canceled) return;

        const homeIndex = modalRes.formValues[0];
        const selectedHome = homes[homeIndex];

        selectedHome.pos = {
            x: Math.floor(player.location.x),
            y: Math.floor(player.location.y),
            z: Math.floor(player.location.z)
        };
        selectedHome.dimension = player.dimension.id;

        saveHomes(player, homes);
        player.sendMessage({
            translate: "cw.home.update.success",
            with: [selectedHome.name, `${selectedHome.pos.x}`, `${selectedHome.pos.y}`, `${selectedHome.pos.z}`]
        });

    } else if (res.selection === 2) {
        // --- Delete Home ---
        const homes = getHomes(player);
        if (homes.length === 0) {
            player.sendMessage({ translate: "cw.home.tp.nohome" });
            return;
        }

        const modal = new ModalFormData();
        modal.title({ translate: "cw.home.menu.delete" });
        modal.dropdown({ translate: "cw.home.tp.dropdown" }, homes.map(h => h.name));
        const modalRes = await modal.show(player);
        if (modalRes.canceled) return;

        const deletedName = homes[modalRes.formValues[0]].name;
        const newHomes = homes.filter((_, i) => i !== modalRes.formValues[0]);
        saveHomes(player, newHomes);
        player.sendMessage({ translate: "cw.home.delete.success", with: [deletedName] });
    }
}

async function home(player) {
    const homes = getHomes(player);
    if (homes.length === 0) {
        player.sendMessage({ translate: "cw.home.tp.nohome" });
        return;
    }

    homes.sort((a, b) => Util.compareStrings(a.name || "", b.name || ""));

    const modal = new ModalFormData();
    modal.title({ translate: "cw.home.tp.title" });
    modal.dropdown({ translate: "cw.home.tp.dropdown" }, homes.map(h => h.name));
    const res = await modal.show(player);
    if (res.canceled) return;

    const selected = homes[res.formValues[0]];
    const targetDimension = selected.dimension ? world.getDimension(selected.dimension) : player.dimension;
    player.sendMessage({ translate: "cw.home.tp.success", with: [selected.name] });
    player.teleport(selected.pos, { dimension: targetDimension });
}
