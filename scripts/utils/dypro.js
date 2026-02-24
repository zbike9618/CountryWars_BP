import * as server from "@minecraft/server";
const { world, system } = server;

export class Dypro {
    constructor(name) {
        this.name = name;
        this.limit = 32000; // 安全のため少し余裕を持たせる
    }

    get idList() {
        const idList = new Set();
        const prefix = `${this.name}.`;
        const oldPrefix = `${this.name}#`;

        for (const id of world.getDynamicPropertyIds()) {
            if (id.startsWith(prefix)) {
                let key = id.replace(prefix, "");
                // 分割用サフィックス（__part0, __count等）を削って元のIDを特定
                key = key.replace(/__part\d+$/, "").replace(/__count$/, "");
                idList.add(key);
            } else if (id.startsWith(oldPrefix)) {
                idList.add(id.replace(oldPrefix, ""));
            }
        }
        return Array.from(idList);
    }

    set(path, data) {
        const fullPath = `${this.name}.${path}`;
        const json = JSON.stringify(data);

        // 既存のデータを（分割版含め）一旦全て削除してクリーンにする
        this.delete(path);

        if (json.length <= this.limit) {
            world.setDynamicProperty(fullPath, json);
        } else {
            // 分割保存
            const count = Math.ceil(json.length / this.limit);
            for (let i = 0; i < count; i++) {
                const chunk = json.slice(i * this.limit, (i + 1) * this.limit);
                world.setDynamicProperty(`${fullPath}__part${i}`, chunk);
            }
            world.setDynamicProperty(`${fullPath}__count`, count);
        }
    }

    get(path) {
        const fullPath = `${this.name}.${path}`;

        // 分割保存されているか確認
        const count = world.getDynamicProperty(`${fullPath}__count`);
        if (count !== undefined) {
            let json = "";
            for (let i = 0; i < count; i++) {
                const chunk = world.getDynamicProperty(`${fullPath}__part${i}`);
                if (chunk !== undefined) json += chunk;
            }
            try {
                return JSON.parse(json);
            } catch (e) {
                return undefined;
            }
        }

        // 通常保存（または古い形式）
        let data = world.getDynamicProperty(fullPath);
        if (data === undefined) {
            data = world.getDynamicProperty(`${this.name}#${path}`);
        }

        if (data === undefined) return undefined;
        try {
            return JSON.parse(data);
        } catch (e) {
            return undefined;
        }
    }

    delete(path) {
        const fullPath = `${this.name}.${path}`;

        // 通常版および旧形式の削除
        world.setDynamicProperty(fullPath, undefined);
        world.setDynamicProperty(`${this.name}#${path}`, undefined);

        // 分割版の削除
        const count = world.getDynamicProperty(`${fullPath}__count`);
        if (count !== undefined) {
            for (let i = 0; i < count; i++) {
                world.setDynamicProperty(`${fullPath}__part${i}`, undefined);
            }
            world.setDynamicProperty(`${fullPath}__count`, undefined);
        }
    }

    clear() {
        const data = this.idList;
        for (const id of data) {
            this.delete(id);
        }
    }
}