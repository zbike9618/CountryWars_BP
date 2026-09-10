import { ActionFormData, ModalFormData } from "@minecraft/server-ui";

// Keep the number of UI controls bounded even for a large offline player list.
export async function selectPlayer(player, getPlayers) {
    let query = "";
    let page = 0;
    while (true) {
        const search = new ModalFormData().title("送信先を検索")
            .textField("プレイヤー名（部分一致・空欄で全員）", "名前", { defaultValue: query });
        const input = await search.show(player);
        if (input.canceled) return;
        query = String(input.formValues[0] ?? "").trim();
        page = 0;
        const entries = getPlayers().filter(p => p.name.toLowerCase().includes(query.toLowerCase()))
            .sort((a, b) => a.name.localeCompare(b.name));
        while (true) {
            const pages = Math.max(1, Math.ceil(entries.length / 20));
            const visible = entries.slice(page * 20, (page + 1) * 20);
            const form = new ActionFormData().title("送信先を選択")
                .body(entries.length ? `${entries.length}人 / ${page + 1}・${pages}ページ` : "該当するプレイヤーはいません。");
            form.button("検索し直す");
            form.button("前のページ");
            form.button("次のページ");
            for (const entry of visible) form.button({ text: entry.name });
            const result = await form.show(player);
            if (result.canceled) return;
            if (result.selection === 0) break;
            if (result.selection === 1) { page = Math.max(0, page - 1); continue; }
            if (result.selection === 2) { page = Math.min(pages - 1, page + 1); continue; }
            return visible[result.selection - 3];
        }
    }
}
