#!/bin/bash
set -e

# 创建资源目录
mkdir -p resources/app

# 复制项目文件（排除不需要的文件）
rsync -av \
  --exclude='node_modules' \
  --exclude='.next' \
  --exclude='src-tauri' \
  --exclude='.git' \
  --exclude='*.log' \
  ../ \
  resources/app/

echo "Resources prepared successfully!"
