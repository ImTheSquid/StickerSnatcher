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
    const config = {"info":{"name":"StickerSnatcher","authors":[{"name":"ImTheSquid","discord_id":"262055523896131584","github_username":"ImTheSquid","twitter_username":"ImTheSquid11"}],"version":"1.1.1","description":"Allows for easy sticker saving.","github":"https://github.com/ImTheSquid/StickerSnatcher","github_raw":"https://raw.githubusercontent.com/ImTheSquid/StickerSnatcher/master/StickerSnatcher.plugin.js"},"changelog":[{"title":"Fixes","items":["Made sure PNGs aren't needlessly reconverted on copy."]}],"main":"index.js"};

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

    const {Patcher, WebpackModules, ContextMenu, DiscordModules} = Library;
    const {Dispatcher} = DiscordModules;

    class StickerSnatcher extends Plugin {
        onStart() {
            this.messageContextMenu = WebpackModules.find(mod => mod.default?.displayName === "MessageContextMenu");
            this.imageUtils = WebpackModules.getByProps("copyImage", "saveImage");
            this.stickerComponent = WebpackModules.find(mod => mod.default?.displayName === "Sticker");
            this.stickerMod = WebpackModules.getByProps("isStandardSticker");
            this.master = WebpackModules.getByProps("app", "clipboard", "features", "fileManager");
            this.canvas = document.createElement("canvas");

            // Make sure Nitro stickers are not selectable
            this.standardStickers = new Set();
            Patcher.after(this.stickerComponent, "default", (_, [arg], ret) => {
                if (this.stickerMod.isStandardSticker(arg.sticker)) {
                    this.standardStickers.add(arg.sticker.id);
                }
            });

            this.onChannelChange = _ => {
                // Clear standard stickers to preserve memory
                this.standardStickers.clear();
            }

            Dispatcher.subscribe("CHANNEL_SELECT", this.onChannelChange);

            ContextMenu.getDiscordMenu("MessageContextMenu").then(menu => {
                Patcher.after(menu, "default", (_, [arg], ret) => {
                    if (arg.message.stickerItems.length == 0 || arg.message.stickerItems.some(sticker => this.standardStickers.has(sticker.id) )) {
                        return;
                    }

                    let url = this.stickerMod.getStickerAssetUrl(arg.message.stickerItems[0], {isPreview: false});
    
                    ret.props.children.splice(4, 0, ContextMenu.buildMenuItem({type: "separator"}), ContextMenu.buildMenuItem({label: "Copy Sticker", action: () => {
                        let urlObj = new URL(url);
                        if (urlObj.pathname.endsWith(".png")) {
                            this.imageUtils.copyImage(url);
                        } else {
                            this.convertWebpToPng(url).then(buf => {
                                // Could possibly use this.master.clipboard but I don't feel like it
                                const electron = require("electron");
                                electron.clipboard.writeImage(electron.nativeImage.createFromDataURL(buf));
                            })
                        }
                    }}), ContextMenu.buildMenuItem({label: "Save Sticker", action: () => {
                        this.downloadAndConvertImage(url).then(buf => {
                            this.master.fileManager.saveWithDialog(new Uint8Array(buf), "sticker.png");
                        });
                    }}));
                });
            });
        };

        async downloadAndConvertImage(url) {
            const urlObj = new URL(url);
            
            // If URL ends with .png, no conversion needed so just download to specified path
            let arrayBuf = null;
            if (urlObj.pathname.endsWith(".png")) {
                arrayBuf = await fetch(url).then(r => r.blob()).then(b => b.arrayBuffer());
            } else {
                const data = await this.convertWebpToPng(url);
                const b64 = data.split(",")[1];
                arrayBuf = Buffer.from(b64, "base64");
            }

            return arrayBuf;
        }

        async convertWebpToPng(url) {
            const blob = await fetch(url).then(r => r.blob());
            const imageBitmap = await createImageBitmap(blob);

            this.canvas.width = imageBitmap.width;
            this.canvas.height = imageBitmap.height;
            let context = this.canvas.getContext("2d");

            context.drawImage(imageBitmap, 0, 0);
            return this.canvas.toDataURL("image/png");
        }

        onStop() {
            Dispatcher.unsubscribe("CHANNEL_SELECT", this.onChannelChange);
            Patcher.unpatchAll();
        };
    };

    return StickerSnatcher;
};
        return plugin(Plugin, Api);
    })(global.ZeresPluginLibrary.buildPlugin(config));
})();
/*@end@*/