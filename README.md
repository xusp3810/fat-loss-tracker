# 减脂记录

一个简洁高级的 PWA 减脂记录应用，支持每日记录体重、腰围，并自动生成趋势图。

## 功能

- 输入每日体重和腰围，支持小数点后两位
- 自动保存到浏览器本地存储
- 自动生成体重/腰围趋势图
- 展示周平均体重、周平均腰围、总体下降趋势、最低体重记录
- 支持 PWA，可在手机浏览器添加到主屏幕
- 支持手机和电脑自适应

## 本地运行

需要安装 Node.js。

```bash
node local-server.cjs
```

然后访问：

```text
http://localhost:5173/
```

同一 WiFi 下手机访问时，将 `localhost` 换成电脑的局域网 IP，例如：

```text
http://192.168.1.107:5173/
```

## PWA

项目包含：

- `manifest.json`
- `service-worker.js`
- `icon.svg`

通过 `localhost` 或 HTTPS 访问时，手机浏览器可以添加到主屏幕。

## Supabase 云同步

云同步是可选增强功能。未配置 Supabase 时，应用继续使用 localStorage 本地模式。

配置步骤见 [SUPABASE_SETUP.md](SUPABASE_SETUP.md)。
