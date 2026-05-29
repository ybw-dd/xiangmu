# ==========================================
# 灵讯服务端 Docker 构建
# ==========================================

# 阶段 1: 依赖安装
FROM node:22-alpine AS deps
RUN corepack enable pnpm
WORKDIR /app

# 复制 workspace 配置（包含 lock 文件以保证一致性）
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/server/package.json ./apps/server/
COPY packages/types/package.json ./packages/types/
COPY packages/utils/package.json ./packages/utils/
COPY packages/socket/package.json ./packages/socket/

# 安装依赖
RUN pnpm install --frozen-lockfile --prod=false

# 阶段 2: 构建
FROM node:22-alpine AS builder
RUN corepack enable pnpm
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/server/node_modules ./apps/server/node_modules

# 先复制 Prisma schema（变动频率低，利用层缓存）
COPY apps/server/prisma ./apps/server/prisma
RUN cd apps/server && npx prisma generate

# 再复制源码（变动频率高）
COPY packages ./packages
COPY apps/server/src ./apps/server/src
COPY apps/server/nest-cli.json apps/server/tsconfig.json ./apps/server/

# 构建
RUN pnpm --filter @lingxun/server build

# 阶段 3: 生产运行
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 lingxun

# 复制生产产物
COPY --from=builder /app/apps/server/dist ./dist
COPY --from=builder /app/apps/server/node_modules ./node_modules
COPY --from=builder /app/apps/server/package.json ./
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/apps/server/prisma ./prisma

# 复制启动脚本
COPY apps/server/docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh

USER lingxun

EXPOSE 3001

CMD ["./docker-entrypoint.sh"]
