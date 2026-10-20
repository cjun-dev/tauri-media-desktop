# tauri-media-desktop

基于 Tauri 2.x + React + TypeScript + Vite 的影音桌面端应用。

## 环境要求

- Node.js >= 18
- Rust（rustc / cargo，通过 [rustup](https://rustup.rs/) 安装）
- Xcode Command Line Tools（macOS）

若终端找不到 `cargo`，先执行：

```bash
source "$HOME/.cargo/env"
```

## 安装依赖

```bash
npm install
```

## 运行方法

### 开发模式（推荐）

```bash
npm run tauri dev
```

首次运行会编译 Rust 依赖，耗时较长；成功后自动打开桌面窗口。Tauri 会自动启动 Vite 开发服务器（端口 `1420`）。

### 仅前端开发

```bash
npm run dev
```

在浏览器中调试 UI，不含 Tauri 原生能力。

## 构建打包

详见 [build.md](./build.md)（含 Windows / macOS 注意事项、安装包产物、应用图标等）。

## 推荐 IDE 配置

- [VS Code](https://code.visualstudio.com/) + [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode) + [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)
