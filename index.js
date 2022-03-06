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
    
                    ret.props.children.splice(4, 0, ContextMenu.buildMenuItem({type: "separator"}), ContextMenu.buildMenuItem({label: "Save Sticker", action: () => {
                        this.imageUtils.saveImage(this.stickerMod.getStickerAssetUrl(arg.message.stickerItems[0], {isPreview: false}));
                    }}));
                });
            });
        };

        onStop() {
            Dispatcher.unsubscribe("CHANNEL_SELECT", this.onChannelChange);
            Patcher.unpatchAll();
        };
    };

    return StickerSnatcher;
}