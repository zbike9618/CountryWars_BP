import { turnedOnPlugins } from "./config/plugin_config";
for (const plugin of Object.keys(turnedOnPlugins)) {
    try {
        await import(`./plugins/${plugin}/import.js`);
    } catch (error) {
        console.error(`[PluginController] プラグイン "${plugin}" の読み込みに失敗しました:`, error);
    }
}