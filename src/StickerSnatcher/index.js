module.exports = (Plugin, Library) => {
    "use strict";

    const {Patcher} = Library;
    const {ContextMenu, Webpack} = BdApi;

    class StickerSnatcher extends Plugin {
        onStart() {
            this.getStickerById = Webpack.getModule(Webpack.Filters.byProps("getStickerById")).getStickerById;
            this.copyImage = Webpack.getModule(Webpack.Filters.byProps("copyImage")).copyImage;
            this.canvas = document.createElement("canvas");

            this.unpatch = ContextMenu.patch("message", (tree, props) => {
                // Make sure Nitro stickers are not selectable
                if (props.message.stickerItems.length === 0 || this.getStickerById(props.message.stickerItems[0].id).type === 1) {
                    return;
                }

                const url = `https://media.discordapp.net/stickers/${props.message.stickerItems[0].id}.${props.message.stickerItems[0].format_type === 1 ? "webp" : "png"}`;

                tree.props.children[2].props.children.push(
                     ContextMenu.buildItem({type: "separator"}),
                     ContextMenu.buildItem({label: "Copy Sticker", action: () => {
                         let urlObj = new URL(url);
                         if (urlObj.pathname.endsWith(".png")) {
                             this.copyImage(url);
                         } else {
                             this.convertWebpToPng(url).then(dataURL => {
                                 DiscordNative.clipboard.copyImage(new Uint8Array(Buffer.from(dataURL.split(",")[1], "base64")), "sticker.png");
                             });
                         }
                     }}),
                     ContextMenu.buildItem({label: "Save Sticker", action: () => {
                         this.downloadAndConvertImage(url).then(buf => {
                             DiscordNative.fileManager.saveWithDialog(new Uint8Array(buf), "sticker.png");
                         });
                     }}),
                     ContextMenu.buildItem({type: "separator"})
                 );
            });
        };

        async downloadAndConvertImage(url) {
            const urlObj = new URL(url);
            
            // If URL ends with .png, no conversion needed so just download to specified path
            let arrayBuf;
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
            this.unpatch();
            Patcher.unpatchAll();
        };
    };

    return StickerSnatcher;
}