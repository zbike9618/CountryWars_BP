import { turnedOnPlugins } from "./config/plugin_config";
for (const plugin of Object.keys(turnedOnPlugins)) {
    await import(`./plugins/${plugin}/import.js`)
}