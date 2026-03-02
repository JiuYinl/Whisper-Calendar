import {
  App,
  ItemView,
  Notice,
  Plugin,
  PluginSettingTab,
  Setting,
  TFile,
  WorkspaceLeaf,
} from "obsidian";

const VIEW_TYPE = "whisper-calendar-view";

/* ───── 默认设置 ───── */
interface WhisperSettings {
  whispersPath: string;            // vault 根目录下的路径
  emptyText: string;               // 没内容时显示
}
const DEFAULT_SETTINGS: WhisperSettings = {
  whispersPath: "whispers.json",
  emptyText: "今天还没有悄悄话。",
};

/* ───── 工具函数 ───── */
const pad = (n: number) => String(n).padStart(2, "0");
const toKey = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

async function ensureFile(app: App, path: string, init = "{}") {
  const f = app.vault.getAbstractFileByPath(path);
  if (f instanceof TFile) return f;

  // 递归创建中间文件夹
  const segs = path.split("/");
  segs.pop();
  let cur = "";
  for (const s of segs) {
    cur = cur ? `${cur}/${s}` : s;
    if (!app.vault.getAbstractFileByPath(cur)) await app.vault.createFolder(cur);
  }
  return await app.vault.create(path, init);
}

async function readWhispers(app: App, path: string): Promise<Record<string, string>> {
  try {
    const f = await ensureFile(app, path, "{}");
    const raw = await app.vault.read(f);
    const obj = JSON.parse(raw);
    return obj && typeof obj === "object" ? obj : {};
  } catch (e) {
    console.error("[Whisper] 读取失败", e);
    new Notice("读取 whispers.json 失败，已返回空对象");
    return {};
  }
}

/* ───── 视图 ───── */
class WhisperView extends ItemView {
  plugin: WhisperCalendarPlugin;

  // 当前日期 & DOM 引用
  sel: Date = new Date();
  inputEl!: HTMLInputElement;
  dateEl!: HTMLElement;
  textEl!: HTMLElement;

  constructor(leaf: WorkspaceLeaf, plugin: WhisperCalendarPlugin) {
    super(leaf);
    this.plugin = plugin;
  }
  getViewType() { return VIEW_TYPE; }
  getDisplayText() { return "Whisper"; }
  getIcon() { return "calendar-days"; }

  /* ---------- 生成 UI ---------- */
  async onOpen() {
    const el = this.containerEl;
    el.empty();
    el.addClass("wc-wrap");

    /* nav 行 */
    const nav = el.createDiv({ cls: "wc-nav" });
    const btnPrev = nav.createEl("button", { cls: "wc-nav-btn", text: "‹" });
    const btnNext = nav.createEl("button", { cls: "wc-nav-btn", text: "›" });
    this.inputEl = nav.createEl("input", { type: "date", cls: "wc-nav-input" });

    btnPrev.onclick = () => this.shiftDate(-1);
    btnNext.onclick = () => this.shiftDate(1);
    this.inputEl.onchange = () => {
     const v = this.inputEl.value;
     if (!v) return;                             // 空值直接返回

     const parts = v.split("-");
     if (parts.length !== 3) return;              // 防御：格式不对

     const y = Number(parts[0]);
      const m = Number(parts[1]);
      const d = Number(parts[2]);

      this.sel = new Date(y, m - 1, d);
      this.render();
  };

    /* 卡片 */
    const card = el.createDiv({ cls: "wc-card" });
    card.createDiv({ cls: "wc-card-title", text: "先生今天想对小孩说" });
    this.dateEl = card.createDiv({ cls: "wc-card-date" });
    this.textEl = card.createDiv({ cls: "wc-card-text" });

    this.inputEl.value = toKey(this.sel);
    await this.render();
  }

  shiftDate(delta: number) {
    this.sel.setDate(this.sel.getDate() + delta);
    this.inputEl.value = toKey(this.sel);
    this.render();
  }

  /* ---------- 渲染内容 ---------- */
  async render() {
    const key = toKey(this.sel);
    const map = await this.plugin.getWhispers();
    const text = map[key] ?? this.plugin.settings.emptyText;

    this.dateEl.setText(key);
    this.textEl.setText(text);
  }
}

/* ───── 插件主体 ───── */
export default class WhisperCalendarPlugin extends Plugin {
  settings!: WhisperSettings;

  private cache: Record<string, string> | null = null;   // 简单缓存

  async onload() {
    await this.loadSettings();

    this.registerView(VIEW_TYPE, leaf => new WhisperView(leaf, this));

    this.addRibbonIcon("calendar-days", "Whisper", () => this.openView());
    this.addCommand({
      id: "open-whisper",
      name: "打开 Whisper 面板",
      callback: () => this.openView(),
    });

    this.addSettingTab(new WhisperSettingTab(this.app, this));
  }

  onunload() {}

  async openView() {
    const leaf =
      this.app.workspace.getRightLeaf(false) ??
      this.app.workspace.getLeaf(true);
    await leaf.setViewState({ type: VIEW_TYPE, active: true });
    this.app.workspace.revealLeaf(leaf);
  }

  /* ---------- 数据 ---------- */
  async getWhispers() {
    if (this.cache) return this.cache;
    this.cache = await readWhispers(this.app, this.settings.whispersPath);
    return this.cache;
  }

  /* ---------- 设置 ---------- */
  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }
  async saveSettings() {
    await this.saveData(this.settings);
    this.cache = null;             // 路径改了重读
  }
}

/* ───── 设置面板 ───── */
class WhisperSettingTab extends PluginSettingTab {
  plugin: WhisperCalendarPlugin;
  constructor(app: App, plugin: WhisperCalendarPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }
  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    new Setting(containerEl)
      .setName("whispers.json 路径")
      .setDesc("相对库根目录，如：whispers.json 或 data/whispers.json")
      .addText(t => t
        .setPlaceholder("whispers.json")
        .setValue(this.plugin.settings.whispersPath)
        .onChange(async v => {
          this.plugin.settings.whispersPath = v.trim() || "whispers.json";
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName("占位文本")
      .setDesc("当天没有悄悄话时显示")
      .addText(t => t
        .setValue(this.plugin.settings.emptyText)
        .onChange(async v => {
          this.plugin.settings.emptyText = v;
          await this.plugin.saveSettings();
        }));
  }
}
