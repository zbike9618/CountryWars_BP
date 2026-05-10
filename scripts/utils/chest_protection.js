import * as server from "@minecraft/server"
import { MessageFormData, ModalFormData } from "@minecraft/server-ui"
import { Dypro } from "./dypro"

const chestDatas = new Dypro("chest")
const playerDatas = new Dypro("player")
const { world, system } = server

const protectionSet = new Set([
    "minecraft:chest",
    "minecraft:trapped_chest",
    "minecraft:barrel",
])

world.beforeEvents.playerInteractWithBlock.subscribe((ev) => {
    const block = ev.block
    const player = ev.player
    
    if (protectionSet.has(block.typeId)) {
        const id = locToid(block.location, block.dimension.id)
        const chestData = chestDatas.get(id)
        
        if (chestData) {
            if (!chestData.allow.includes(player.id)) {
                const owner = playerDatas.get(chestData.owner) || { name: "不明" }
                player.sendMessage(`§c${owner.name}のチェストです`)
                ev.cancel = true;
                return;
            }
            
            if (player.isSneaking) {
                ev.cancel = true;
                system.run(() => {
                    showChestSettings(player, id, chestData);
                });
            }
        } else if (player.isSneaking) {
            ev.cancel = true;
            system.run(() => {
                showProtectPrompt(player, id);
            });
        }
    }
})

world.beforeEvents.playerBreakBlock.subscribe((ev) => {
    const block = ev.block
    const player = ev.player
    
    if (protectionSet.has(block.typeId)) {
        const id = locToid(block.location, block.dimension.id)
        const chestData = chestDatas.get(id)
        
        if (chestData) {
            if (!chestData.allow.includes(player.id)) {
                const owner = playerDatas.get(chestData.owner) || { name: "不明" }
                player.sendMessage(`§c${owner.name}のチェストです`)
                ev.cancel = true;
                return;
            } else {
                chestDatas.delete(id)
                player.sendMessage("§aチェストの保護を解除しました")
                return;
            }
        }
    }
})

function showChestSettings(player, id, chestData) {
    const playersNames = [];
    for (const pid of chestData.allow) {
        const playerData = playerDatas.get(pid);
        if (playerData) {
            playersNames.push(playerData.name);
        }
    }
    
    const form = new ModalFormData()
    form.title("チェスト設定")
    form.textField("アクセス許可 (コンマ区切りで入力)", "STEVE,ALEX", playersNames.join(","))
    form.toggle("保護", true)
    
    form.show(player).then((res) => {
        if (res.canceled) return
        
        if (!res.formValues[1]) {
            chestDatas.delete(id)
            player.sendMessage("§aチェストの保護を解除しました")
            return;
        }
        
        const names = res.formValues[0].split(",").map(n => n.trim()).filter(n => n.length > 0)
        const allow = [];
        
        for (const pid of playerDatas.idList) {
            const data = playerDatas.get(pid);
            if (data && data.name && names.includes(data.name)) {
                allow.push(pid);
            }
        }
        
        if (!allow.includes(chestData.owner)) {
            allow.push(chestData.owner);
        }
        
        chestData.allow = allow;
        chestDatas.set(id, chestData);
        player.sendMessage("§aチェストの設定を更新しました");
    }).catch(e => console.error(e));
}

function showProtectPrompt(player, id) {
    const message = new MessageFormData()
    message.title("チェスト保護")
    message.body("チェストを保護しますか？")
    message.button2("はい")
    message.button1("いいえ")
    
    message.show(player).then((res) => {
        if (res.canceled) return
        if (res.selection === 1) {
            chestDatas.set(id, { owner: player.id, allow: [player.id] })
            player.sendMessage("§aチェストを保護しました");
        }
    }).catch(e => console.error(e));
}

function locToid(loc, dim) {
    const x = Math.floor(loc.x)
    const y = Math.floor(loc.y)
    const z = Math.floor(loc.z)
    return `${dim},${x},${y},${z}`
}

function idToLoc(id) {
    const [dim, x, y, z] = id.split(",")
    return { dimension: world.getDimension(dim), location: { x: Number(x), y: Number(y), z: Number(z) } }
}
