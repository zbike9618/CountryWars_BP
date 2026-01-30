import { turnedOnPlugins } from "./config/plugin_config";
for (const plugin of turnedOnPlugins) {
    await import(`./plugins/${plugin}/import.js`)
}