import { App, PluginSettingTab, Setting } from "obsidian";

export interface WhisperSettings {
  whispersFile: string;
  wishesFile: string;
  messagesPrefix: string;
  defaultViewSide: "left" | "right";
}

export const DEFAULT_SETTINGS: WhisperSettings = {
  whispersFile: "whispers.json",
  wishesFile: "wishes.json",
  messagesPrefix: "messages-",
  defaultViewSide: "right",
};

export class WhisperSettingTab extends PluginSettingTab {
  plugin: any;
  constructor(app: App, plugin: any) { super(app, plugin); this.plugin = plugin; }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("h3", { text: "Whisper Calendar 设置" });

    new Setting(containerEl)
      .setName("每日悄悄话 JSON")
      .addText(t => t.setValue(this.plugin.settings.whispersFile)
        .onChange(async v => { this.plugin.settings.whispersFile = v.trim(); await this.plugin.saveSettings(); }));

    new Setting(containerEl)
      .setName("节日愿望 JSON")
      .addText(t => t.setValue(this.plugin.settings.wishesFile)
        .onChange(async v => { this.plugin.settings.wishesFile = v.trim(); await this.plugin.saveSettings(); }));

    new Setting(containerEl)
      .setName("留言文件前缀")
      .addText(t => t.setValue(this.plugin.settings.messagesPrefix)
        .onChange(async v => { this.plugin.settings.messagesPrefix = v.trim(); await this.plugin.saveSettings(); }));

    new Setting(containerEl)
      .setName("默认显示在")
      .addDropdown(d => d
        .addOption("left",  "左侧")
        .addOption("right", "右侧")
        .setValue(this.plugin.settings.defaultViewSide)
        .onChange(async v => { this.plugin.settings.defaultViewSide = v as any; await this.plugin.saveSettings(); }));
  }
}
