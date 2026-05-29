#!/bin/sh
set -e

echo "=== 灵讯服务端启动 ==="

# 应用数据库迁移
echo "正在应用数据库迁移..."
npx prisma migrate deploy --schema=./prisma/schema.prisma 2>/dev/null || echo "迁移跳过（可能无待应用的迁移）"

# 启动服务
echo "正在启动服务..."
exec node dist/main
