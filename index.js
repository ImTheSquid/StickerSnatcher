module.exports = (Plugin, Library) => {
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
                        this.convertWebpToPng(url).then(buf => {
                            // Could possibly use this.master.clipboard but I don't feel like it
                            const electron = require("electron");
                            electron.clipboard.writeImage(electron.nativeImage.createFromDataURL(buf));
                        })
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
            const pathComponents = urlObj.pathname.split("/");
            const fileName = pathComponents[pathComponents.length - 1];

            // If URL ends with .png, no conversion needed so just download to specified path
            let arrayBuf = null;
            if (fileName.endsWith(".png")) {
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
}