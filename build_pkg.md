# OnlineNote 打包指南

## 打包说明

本项目使用 Tauri 将 Next.js 应用打包成独立的 macOS 桌面应用。

## 应用架构

```
OnlineWebNote.app/
├── Contents/
│   ├── MacOS/
│   │   └── app              # Tauri 主程序
│   └── Resources/
│       ├── nodejs/          # Node.js 运行时 (v20.11.1)
│       │   └── bin/node
│       └── app/             # Next.js 应用
│           ├── .next/       # 构建输出
│           ├── node_modules/
│           └── package.json
```

## 打包步骤

### 1. 准备环境

确保已安装：
- Node.js
- Rust (通过 `brew install rust`)
- Tauri CLI (已包含在项目中)

### 2. 配置 Rust 国内镜像

创建 `~/.cargo/config.toml`：

```toml
[registries.crates-io]
protocol = "sparse"

[source.crates-io]
replace-with = 'ustc'

[source.ustc]
registry = "sparse+https://mirrors.ustc.edu.cn/crates.io-index/"
```

### 3. 下载 Node.js 运行时

```bash
cd src-tauri
mkdir -p nodejs
curl -L http://mirrors.ustc.edu.cn/node/v20.11.1/node-v20.11.1-darwin-arm64.tar.gz | tar -xz -C nodejs --strip-components=1
```

### 4. 准备应用资源

运行准备脚本：

```bash
cd src-tauri
chmod +x prepare-resources.sh
./prepare-resources.sh
```

这会复制项目文件到 `src-tauri/resources/app/`（排除 node_modules、.next 等）

### 5. 安装依赖并构建

```bash
cd src-tauri/resources/app
npm install
npm run build
```

### 6. 构建 Tauri 应用

```bash
cd ../../..  # 回到项目根目录
npm run tauri:build
```

构建完成后，应用位于：
`src-tauri/target/release/bundle/macos/OnlineWebNote.app`

### 7. 复制资源到应用包

```bash
cp -R src-tauri/resources/app src-tauri/target/release/bundle/macos/OnlineWebNote.app/Contents/Resources/
```

## 使用应用

### 开发模式

```bash
npm run tauri:dev
```

### 运行打包后的应用

```bash
open src-tauri/target/release/bundle/macos/OnlineWebNote.app
```

### 安装到 Applications

```bash
cp -R src-tauri/target/release/bundle/macos/OnlineWebNote.app /Applications/
```

## 创建 DMG 安装包

由于沙箱限制，Tauri 自动 DMG 打包可能失败。可以手动创建：

```bash
brew install create-dmg

create-dmg \
  --volname "OnlineNote Installer" \
  --window-pos 200 120 \
  --window-size 660 400 \
  --icon-size 100 \
  --app-drop-link 480 170 \
  --icon "OnlineWebNote.app" 180 170 \
  "OnlineNote.dmg" \
  "src-tauri/target/release/bundle/macos/OnlineWebNote.app"
```

## 关键配置说明

### next.config.ts

```typescript
const nextConfig: NextConfig = {
  output: 'standalone',  // 生成独立运行版本
  distDir: '.next',
  // ... 其他配置
};
```

### tauri.conf.json

```json
{
  "build": {
    "frontendDist": "http://localhost:3000",
    "devUrl": "http://localhost:3000",
    "beforeDevCommand": "npm run dev",
    "beforeBuildCommand": "echo 'Skipping build, using pre-built resources'"
  },
  "bundle": {
    "resources": [
      "nodejs/**/*",
      "resources/app/**/*"
    ]
  }
}
```

### Rust 启动逻辑 (src-tauri/src/lib.rs)

应用启动时自动：
1. 检测运行环境（开发/生产）
2. 使用内置 Node.js 启动 Next.js 服务（端口 3000）
3. Tauri 窗口加载 localhost:3000

## 注意事项

1. **首次启动较慢**：需要启动 Node.js 和 Next.js 服务（约 3-5 秒）

2. **端口占用**：确保 3000 端口未被占用

3. **数据存储**：应用数据存储在：
   - 开发模式：`/Users/mac/Documents/trae_projects/onlinenote/data/`
   - 生产模式：应用资源目录（建议改为用户目录）

4. **签名问题**：未签名的应用可能需要在系统设置中允许运行：
   - 系统设置 → 隐私与安全性 → 安全性 → 允许从以下位置下载的应用

5. **体积优化**：当前包含完整 Node.js (~40MB) 和 node_modules (~200MB)，可考虑：
   - 使用 `npm prune --production` 移除开发依赖
   - 删除 Node.js 不需要的文件（headers、docs 等）

## 故障排查

### 应用无法启动

检查日志：
```bash
/Applications/OnlineWebNote.app/Contents/MacOS/app
```

### 服务启动失败

手动测试服务：
```bash
cd /Applications/OnlineWebNote.app/Contents/Resources/app
../nodejs/bin/node node_modules/next/dist/bin/next start -p 3000
```

### 端口被占用

查找并结束占用 3000 端口的进程：
```bash
lsof -ti:3000 | xargs kill -9
```
