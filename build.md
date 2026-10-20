# 打包说明（build.md）

本文说明本项目在各平台上使用 Tauri 2.x 打包的步骤与注意事项。

## 通用命令

```bash
npm install
npm run tauri build
```

打包产物位于 `src-tauri/target/release/bundle/`。  
未打安装包时，可执行文件在：`src-tauri/target/release/`。

当前 `src-tauri/tauri.conf.json` 中 `bundle.targets` 为 `"all"`，会尝试生成该平台上所有默认安装包格式。

## 平台说明

**在什么系统上打包，就会得到对应平台的应用：**

| 打包环境 | 典型产物 |
|---------|---------|
| macOS   | `.app`、`.dmg` |
| Windows | `.msi`、`.exe`（NSIS） |
| Linux   | `.deb`、`.AppImage` 等 |

在 Mac 上执行 `npm run tauri build`，只会生成 Mac 应用，不会自动生成 Windows 安装包；反之亦然。

---

## Windows 打包

Windows 安装包需要在 **Windows 环境** 中构建（Mac 无法直接交叉编译出 Windows 包）。

### 环境要求

- Node.js >= 18
- Rust（[rustup](https://rustup.rs/)）
- **Visual Studio Build Tools**（勾选「使用 C++ 的桌面开发」）
- **WebView2**：Windows 10/11 通常已自带；缺失时可安装 [WebView2 Runtime](https://developer.microsoft.com/microsoft-edge/webview2/)

### 打包命令

```bash
npm install
npm run tauri build
```

产物目录：`src-tauri/target/release/bundle/`（含 `msi/`、`nsis/` 等）。

| 格式 | 说明 |
|------|------|
| `.exe`（直接运行） | `src-tauri/target/release/tauri-media-desktop.exe` |
| `.msi` | 基于 WiX 的安装包 |
| `.exe`（NSIS） | 基于 NSIS 的安装程序 |

### 可选方案

- 在 Windows 电脑或虚拟机中打包
- 使用 GitHub Actions 等 CI，在 `windows-latest` 上自动构建

### 注意事项

#### 1. WiX / NSIS 下载超时（国内常见）

打包 MSI 时，Tauri 会从 GitHub 下载 WiX 工具；NSIS 安装包同理。若出现：

```text
Downloading https://github.com/wixtoolset/wix3/releases/.../wix314-binaries.zip
failed to bundle project: `timeout: global`
```

说明 **Rust 编译已成功**，失败发生在「下载打包工具」阶段。

**处理方式：手动预置工具**

1. 下载 [wix314-binaries.zip](https://github.com/wixtoolset/wix3/releases/download/wix3141rtm/wix314-binaries.zip)  
   解压到：`%LOCALAPPDATA%\tauri\WixTools314`  
   （例如 `C:\Users\<用户名>\AppData\Local\tauri\WixTools314`）  
   目录内应能直接看到 `candle.exe`、`light.exe` 等。

2. 若还要打 NSIS 包，下载 [nsis-3.zip](https://github.com/tauri-apps/binary-releases/releases/download/nsis-3/nsis-3.zip)  
   解压到：`%LOCALAPPDATA%\tauri\NSIS`

3. 重新执行：`npm run tauri build`

**有代理时（仅 SOCKS 较可靠）：**

```powershell
$env:all_proxy="socks5://127.0.0.1:端口"
npm run tauri build
```

普通 HTTP 代理往往对 Tauri CLI 下载无效。

#### 2. 只需要可执行文件、暂时不要安装包

```powershell
npm run tauri build -- --no-bundle
```

或在 `tauri.conf.json` 中将 `bundle.targets` 改为 `[]` / 指定需要的目标（如只保留 `nsis`）。

#### 3. 中文 `productName` 导致 `light.exe` 失败

若日志类似：

```text
Running light to produce ...\咸鱼影音播放器_0.1.0_x64_en-US.msi
failed to bundle project: `failed to run ...\light.exe`
```

原因是 WiX 默认使用 `en-US`（代码页 1252），无法写入中文产品名。本项目已在 `tauri.conf.json` 中配置：

```json
"bundle": {
  "windows": {
    "wix": {
      "language": "zh-CN"
    }
  }
}
```

也可把 `productName` 改成纯 ASCII（窗口标题仍可用中文 `app.windows[].title`）。

#### 4. 杀毒软件 / SmartScreen

未签名的 `.exe` / `.msi` 可能被 Windows Defender 或 SmartScreen 拦截。内部分发可添加排除项；对外发布建议配置代码签名证书。

#### 5. 路径与权限

- 建议在非过深、无特殊字符的路径下构建（避免部分工具对长路径、中文路径不友好）。
- 以普通用户权限打包即可，一般不需要管理员身份运行构建命令；安装生成的 MSI/NSIS 包时可能需要管理员权限。

#### 6. 交叉编译

不要在 macOS / Linux 上指望直接交叉编译出可用的 Windows 安装包。请在本机 Windows、虚拟机或 CI（如 GitHub Actions `windows-latest`）上构建。

---

## macOS 打包

### 环境要求

- Node.js >= 18
- Rust（[rustup](https://rustup.rs/)）
- **Xcode Command Line Tools**（或完整 Xcode）

```bash
xcode-select --install
# 若终端找不到 cargo：
source "$HOME/.cargo/env"
```

### 典型产物

| 格式 | 说明 |
|------|------|
| `.app` | 应用程序包 |
| `.dmg` | 磁盘镜像分发包 |

产物一般在 `src-tauri/target/release/bundle/macos/`、`dmg/` 等目录。

### 注意事项

#### 1. Apple Silicon 与 Intel

- 在 **Apple Silicon（M 系列）** 上默认打出 `aarch64`（arm64）应用。
- 在 **Intel Mac** 上默认打出 `x86_64` 应用。
- 若要在另一架构上运行，需目标机架构匹配，或做通用二进制（universal）构建；不要假设「在一台 Mac 上打一次就能覆盖所有 Mac」。

#### 2. 首次打开被拦截（未签名 / 未公证）

未配置 Apple 开发者签名与公证时，用户双击可能提示「无法打开，因为无法验证开发者」。内测可用：

- 系统设置 → 隐私与安全性 → 仍要打开  
- 或：`xattr -cr /path/to/咸鱼影音播放器.app`

对外分发建议配置：

- Apple Developer 账号
- 代码签名（Developer ID Application）
- 公证（Notarization）与装订（Staple）

相关配置可写在 `tauri.conf.json` 的 `bundle.macOS` 以及环境变量（如签名身份、Apple ID 等）中，按 [Tauri macOS 打包文档](https://v2.tauri.app/distribute/sign-macos/) 操作。

#### 3. Gatekeeper 与网络权限

应用若访问本地文件、外网或麦克风等，需在系统隐私设置中授权。打包本身不替代运行时权限弹窗。

#### 4. 不要用 Windows 产物冒充 Mac 包

在 Windows 上构建不会生成可用的 `.app` / `.dmg`。Mac 包必须在 macOS 环境（本机或 CI `macos-latest`）中构建。

---

## 应用图标

桌面应用图标资源位于 `src-tauri/icons/`，由 `src-tauri/tauri.conf.json` 的 `bundle.icon` 引用。

### 打包用图标（核心）

| 文件 | 用途 |
|------|------|
| `icons/32x32.png` | 通用小图标 |
| `icons/128x128.png` | 通用中图标 |
| `icons/128x128@2x.png` | Retina |
| `icons/icon.icns` | macOS |
| `icons/icon.ico` | Windows |

同目录下还有 `icon.png` 以及一批 `Square*.png` / `StoreLogo.png`（偏 Windows Store），一般由 CLI 自动生成，无需手改。

只替换同名文件时通常不必改 `tauri.conf.json`；若更换路径或文件名，需同步更新 `bundle.icon` 数组。

更换图标后需重新打包。若 macOS 上 Dock / Finder 仍显示旧图标，清理图标缓存或改名再打开 `.app` 再试。

### 网页 favicon

开发时浏览器标签页图标由 `index.html` 指定，当前指向 `public/vite.svg`：

```html
<link rel="icon" type="image/svg+xml" href="/vite.svg" />
```

更换 favicon 时，替换该文件或修改 `href`。

### 推荐生成方式

准备一张 **1024×1024** 的源图，用 Tauri CLI 一键生成全套图标：

```bash
npm run tauri icon path/to/your-icon.png
```

会覆盖 `src-tauri/icons/` 下各尺寸 PNG，以及 `.icns` / `.ico`。

改完后需重新运行或打包应用才能生效；macOS 有时还需清理图标缓存后才能看到更新。

---

## 常用命令速查

| 场景 | 命令 |
|------|------|
| 开发运行 | `npm run tauri dev` |
| 正式打包（含安装包） | `npm run tauri build` |
| 只编译不打安装包 | `npm run tauri build -- --no-bundle` |
| 仅前端生产构建 | `npm run build` |
| 生成应用图标 | `npm run tauri icon path/to/your-icon.png` |

---

## 排错简表

| 现象 | 可能原因 | 处理 |
|------|----------|------|
| `timeout: global` 下载 WiX/NSIS | GitHub 网络超时 | 手动放到 `%LOCALAPPDATA%\tauri\...` 或配置 SOCKS 代理 |
| 找不到 `cargo` | Rust 未装或未进 PATH | 安装 rustup；Mac 执行 `source "$HOME/.cargo/env"` |
| Windows 链接/编译 C++ 失败 | 缺少 VS Build Tools | 安装并勾选「使用 C++ 的桌面开发」 |
| Mac 提示无法验证开发者 | 未签名/未公证 | 内测用「仍要打开」或 `xattr`；正式需签名公证 |
| `light.exe` 失败且产物名含中文/`en-US` | WiX 默认英文代码页不支持中文 | `bundle.windows.wix.language` 设为 `zh-CN` |
| 只有 exe，没有 msi | 打包工具下载失败或 targets 配置 | 先确认 WiX 已就绪，或检查 `bundle.targets` |
