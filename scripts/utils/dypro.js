import * as server from "@minecraft/server";
const { world, system } = server;
/**
 * @typedef {Object} Dypro データ保存
 * @property {string} name データ保存名
 * @property {string[]} idList データ保存IDリスト
 * @property {function(path: string, data: any): void} set データ保存
 * @property {function(path: string): any} get データ取得
 * @property {function(path: string): void} delete データ削除
 * @property {function(): void} clear データ削除
 */
export class Dypro {
    constructor(name) {
        this.name = name;
    }
    get idList() {
        const idList = []
        for (const data of world.getDynamicPropertyIds().filter(id => id.startsWith(`${this.name}#`))) {
            idList.push(data.replace(`${this.name}#`, ""))
        }
        return idList
    }
    set(path, data) {
        //includes"_" set
        const name = this.name;
        world.setDynamicProperty(`${name}#${path}`, JSON.stringify(data))

    }
    get(path) {
        const name = this.name;
        const data = world.getDynamicProperty(`${name}#${path}`);
        if (data === undefined) return undefined;
        return JSON.parse(data);
    }
    delete(path) {
        const name = this.name;
        world.setDynamicProperty(`${name}#${path}`, undefined)
    }
    clear() {
        const data = this.idList
        for (const id of data) {
            world.setDynamicProperty(id, undefined)
        }
    }


}
