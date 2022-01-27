/**
 * @name StickerSnatcher
 * @website https://github.com/ImTheSquid/StickerSnatcher
 * @source https://raw.githubusercontent.com/ImTheSquid/StickerSnatcher/master/StickerSnatcher.plugin.js
 */
/*@cc_on
@if (@_jscript)
    
    // Offer to self-install for clueless users that try to run this directly.
    var shell = WScript.CreateObject("WScript.Shell");
    var fs = new ActiveXObject("Scripting.FileSystemObject");
    var pathPlugins = shell.ExpandEnvironmentStrings("%APPDATA%\\BetterDiscord\\plugins");
    var pathSelf = WScript.ScriptFullName;
    // Put the user at ease by addressing them in the first person
    shell.Popup("It looks like you've mistakenly tried to run me directly. \n(Don't do that!)", 0, "I'm a plugin for BetterDiscord", 0x30);
    if (fs.GetParentFolderName(pathSelf) === fs.GetAbsolutePathName(pathPlugins)) {
        shell.Popup("I'm in the correct folder already.", 0, "I'm already installed", 0x40);
    } else if (!fs.FolderExists(pathPlugins)) {
        shell.Popup("I can't find the BetterDiscord plugins folder.\nAre you sure it's even installed?", 0, "Can't install myself", 0x10);
    } else if (shell.Popup("Should I copy myself to BetterDiscord's plugins folder for you?", 0, "Do you need some help?", 0x34) === 6) {
        fs.CopyFile(pathSelf, fs.BuildPath(pathPlugins, fs.GetFileName(pathSelf)), true);
        // Show the user where to put plugins in the future
        shell.Exec("explorer " + pathPlugins);
        shell.Popup("I'm installed!", 0, "Successfully installed", 0x40);
    }
    WScript.Quit();

@else@*/

module.exports = (() => {
    const config = {"info":{"name":"StickerSnatcher","authors":[{"name":"ImTheSquid","discord_id":"262055523896131584","github_username":"ImTheSquid","twitter_username":"ImTheSquid11"}],"version":"1.0.1","description":"Allows for easy sticker saving.","github":"https://github.com/ImTheSquid/StickerSnatcher","github_raw":"https://raw.githubusercontent.com/ImTheSquid/StickerSnatcher/master/StickerSnatcher.plugin.js"},"changelog":[{"title":"Discord Fixes","items":["Fixed context menus not working."]}],"main":"index.js"};

    return !global.ZeresPluginLibrary ? class {
        constructor() {this._config = config;}
        getName() {return config.info.name;}
        getAuthor() {return config.info.authors.map(a => a.name).join(", ");}
        getDescription() {return config.info.description;}
        getVersion() {return config.info.version;}
        load() {
            BdApi.showConfirmationModal("Library Missing", `The library plugin needed for ${config.info.name} is missing. Please click Download Now to install it.`, {
                confirmText: "Download Now",
                cancelText: "Cancel",
                onConfirm: () => {
                    require("request").get("https://rauenzi.github.io/BDPluginLibrary/release/0PluginLibrary.plugin.js", async (error, response, body) => {
                        if (error) return require("electron").shell.openExternal("https://betterdiscord.net/ghdl?url=https://raw.githubusercontent.com/rauenzi/BDPluginLibrary/master/release/0PluginLibrary.plugin.js");
                        await new Promise(r => require("fs").writeFile(require("path").join(BdApi.Plugins.folder, "0PluginLibrary.plugin.js"), body, r));
                    });
                }
            });
        }
        start() {}
        stop() {}
    } : (([Plugin, Api]) => {
        const plugin = (Plugin, Library) => {
    "use strict";

    const {Logger, Patcher, WebpackModules, ContextMenu} = Library;

    class StickerSnatcher extends Plugin {
        onStart() {
            this.messageContextMenu = WebpackModules.find(mod => mod.default?.displayName === "MessageContextMenu");
            this.imageUtils = WebpackModules.getByProps("copyImage", "saveImage");

            ContextMenu.getDiscordMenu("MessageContextMenu").then(menu => {
                Patcher.after(menu, "default", (_, [arg], ret) => {
                    if (arg.message.stickerItems.length == 0) {
                        return;
                    }
    
                    ret.props.children.splice(4, 0, ContextMenu.buildMenuItem({type: "separator"}), ContextMenu.buildMenuItem({label: "Save Sticker", action: () => {
                        this.imageUtils.saveImage(this.getLinkForStickerInMessageWithID(arg.message.id));
                    }}));
                });
            });
        };

        getLinkForStickerInMessageWithID(messageID) {
            const accessories = document.getElementById(`message-accessories-${messageID}`);

            if (!accessories) {
                Logger.log("Unable to find accessories element");
                return null;
            }

            const sticker = this.findFirstInDOMChildren(accessories, /clickableSticker/, element => element.className);

            if (!sticker) {
                Logger.log("Unable to find sticker element");
                return null;
            }

            return sticker.children[0].children[0].children[0].src;
        };

        findFirstInDOMChildren(element, regex, childFormat) {
            for (const child of element.children) {
                if (childFormat(child) && regex.test(childFormat(child))) {
                    return child;
                }
            }
            return null;
        };

        onStop() {
            Patcher.unpatchAll();
        };
    };

    return StickerSnatcher;
};
        return plugin(Plugin, Api);
    })(global.ZeresPluginLibrary.buildPlugin(config));
})();
/*@end@*/