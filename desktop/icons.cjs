const fs = require("node:fs");
const path = require("node:path");
const { createHash } = require("node:crypto");
class IconCache {
  constructor({ app, nativeImage, directory, onChange }) {
    this.app = app;
    this.nativeImage = nativeImage;
    this.directory = path.join(directory, "icons");
    fs.mkdirSync(this.directory, { recursive: true });
    this.values = {};
    this.pending = new Map();
    this.generations = new Map();
    this.attempts = new Map();
    this.revision = 0;
    this.onChange = onChange;
  }
  file(id, custom = false) {
    return path.join(
      this.directory,
      createHash("sha256").update(id).digest("hex") +
        (custom ? ".custom" : ".native") +
        ".png",
    );
  }
  put(id, img, custom = false) {
    if (img.isEmpty())
      throw Error("Не удалось прочитать иконку. Выбери PNG, JPG, ICO или EXE.");
    const image = img.resize({ width: 64, height: 64, quality: "best" });
    fs.writeFileSync(this.file(id, custom), image.toPNG());
    this.values[id] = image.toDataURL();
    this.revision++;
    this.onChange?.();
  }
  async load(id, metadata, force = false) {
    if (this.pending.has(id)) return this.pending.get(id);
    const file = this.file(id, !!metadata.customIcon);
    if (!force && fs.existsSync(file)) {
      if (!this.values[id]) {
        const cached = this.nativeImage.createFromPath(file);
        if (!cached.isEmpty()) {
          this.values[id] = cached.toDataURL();
          this.revision++;
          return;
        }
      } else {
        return;
      }
    }
    if (
      !metadata.path ||
      (!force && Date.now() - (this.attempts.get(id) || 0) < 60000)
    )
      return;
    this.attempts.set(id, Date.now());
    const generation = this.generations.get(id) || 0;
    const task = (async () => {
      try {
        const img = await this.app.getFileIcon(metadata.path, {
          size: "large",
        });
        if (generation === (this.generations.get(id) || 0)) this.put(id, img);
      } catch {}
    })();
    this.pending.set(id, task);
    try {
      await task;
    } finally {
      this.pending.delete(id);
    }
  }
  async choose(id, filename) {
    this.generations.set(id, (this.generations.get(id) || 0) + 1);
    if (fs.statSync(filename).size > 20000000 && !/\.exe$/i.test(filename))
      throw Error("Выбери изображение размером до 20 МБ.");
    const img = /\.exe$/i.test(filename)
      ? await this.app.getFileIcon(filename, { size: "large" })
      : this.nativeImage.createFromPath(filename);
    this.put(id, img, true);
  }
  async reset(id, metadata) {
    this.generations.set(id, (this.generations.get(id) || 0) + 1);
    await this.pending.get(id);
    try {
      fs.unlinkSync(this.file(id, true));
    } catch {}
    delete this.values[id];
    metadata.customIcon = false;
    await this.load(id, metadata, true);
    this.revision++;
    this.onChange?.();
  }
  export(apps) {
    return Object.fromEntries(
      Object.entries(apps)
        .filter(([id, a]) => a.customIcon && fs.existsSync(this.file(id, true)))
        .map(([id]) => [
          id,
          fs.readFileSync(this.file(id, true)).toString("base64"),
        ]),
    );
  }
  validateIncoming(bundle, apps) {
    if (!bundle) return {};
    if (typeof bundle !== "object" || Object.keys(bundle).length > 500)
      throw Error("Invalid icons");
    const result = {};
    for (const [id, value] of Object.entries(bundle)) {
      if (
        !Object.hasOwn(apps, id) ||
        typeof value !== "string" ||
        value.length > 100000
      )
        throw Error("Invalid icon");
      const image = this.nativeImage.createFromBuffer(
        Buffer.from(value, "base64"),
      );
      if (image.isEmpty()) throw Error("Invalid icon");
      result[id] = image;
    }
    return result;
  }
  restore(images, apps) {
    for (const id of new Set([...Object.keys(apps), ...this.pending.keys()]))
      this.generations.set(id, (this.generations.get(id) || 0) + 1);
    this.values = {};
    this.revision++;
    for (const [id, a] of Object.entries(apps)) a.customIcon = !!images[id];
    for (const [id, img] of Object.entries(images)) this.put(id, img, true);
    for (const [id, a] of Object.entries(apps)) this.load(id, a);
  }
}
module.exports = { IconCache };
