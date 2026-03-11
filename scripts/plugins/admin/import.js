import { turnedOnPlugins } from "../../config/plugin_config";
export const blacklist = turnedOnPlugins["admin"].blackList;
export const opWhiteList = turnedOnPlugins["admin"].opWhiteList;
export const creativeWhiteList = turnedOnPlugins["admin"].creativeWhiteList;
import "./commands";
import "./system"