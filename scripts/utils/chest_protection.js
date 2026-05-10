import * as server from "@minecraft/server"
import { MessageFormData, ModalFormData } from "@minecraft/server-ui"
import { Dypro } from "./dypro"
import { Util } from "./util"
const chestDatas = new Dypro("chest")
const playerDatas = new Dypro("player")
const { world, system } = server

const protectionList = [
    "minecraft:chest",
    "minecraft:trapped_chest",
    "minecraft:barrel",
]
world.beforeEvents.playerInteractWithBlock.subscribe((ev) => {
    const block = ev.block
    const player = ev.player
    if (protectionList.includes(block.typeId)) {
        const id = locToid(block.location, block.dimension.id)
        const chestData = chestDatas.get(id)
        if (chestData) {
            if (!chestData.allow.includes(player.id)) {
                const owner = playerDatas.get(chestData.owner)
                player.sendMessage(`§c${owner.name}のチェストです`)
                ev.cancel = true;
                return;
            }
            const playersNames = [];
            for (const id of chestData.allow) {
                const playerData = playerDatas.get(id);
                if (playerData) {
                    playersNames.push(playerData.name);
                }
            }
            const form = new ModalFormData()
            form.title("チェスト設定")
            form.textField("アクセス許可", "STEVE,ALEX", playersNames.join(","))
            form.toggle("保護", { defaultValue: true })
            form.show(player).then((res) => {
                if (res.canceled) return
                if (!res.formValues[1]) {
                    chestDatas.delete(id)
                    player.sendMessage("§aチェストの保護を解除しました")
                    return;
                }
                const names = res.formValues[0].split(",")
                const allow = [];
                for (const name of names) {
                    const playerData = playerDatas.find((data) => data.name === name);
                    if (playerData) {
                        allow.push(playerData.id);
                    }
                }
                chestData.allow = allow;
                chestDatas.set(id, chestData);
            })
        } else if (player.isSneaking) {
            const message = new MessageFormData()
            message.title("チェスト保護")
            message.body("チェストを保護します")
            message.button2("はい")
            message.button1("いいえ")
            message.show(player).then((res) => {
                if (res.canceled) return
                if (res.formValues[1]) {
                    const id = locToid(block.location, block.dimension.id)
                    chestDatas.set(id, { owner: player.id, allow: [player.id] })
                }
            })
        }
    }


})
world.beforeEvents.playerBreakBlock.subscribe((ev) => {
    const block = ev.block
    const player = ev.player
    if (protectionList.includes(block.typeId)) {
        const id = locToid(block.location, block.dimension.id)
        const chestData = chestDatas.get(id)
        if (chestData) {
            if (!chestData.allow.includes(player.id)) {
                const owner = playerDatas.get(chestData.owner)
                player.sendMessage(`§c${owner.name}のチェストです`)
                ev.cancel = true;
                return;
            }
            else {
                chestDatas.delete(id)
                player.sendMessage("§aチェストの保護を解除しました")
                return;
            }
        }
    }
})
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
