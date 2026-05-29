.PHONY: help install dev build docker-up docker-down db-generate db-migrate db-push db-seed lint format

# ==========================================
# 灵讯（LingXun）Makefile
# ==========================================

help: ## 显示帮助
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | \
	awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

install: ## 安装依赖
	pnpm install

dev: ## 启动开发环境
	@echo "启动服务端..."
	@make -j 2 dev-server dev-web

dev-server: ## 启动后端开发服务器
	pnpm --filter @lingxun/server dev

dev-web: ## 启动前端开发服务器
	pnpm --filter @lingxun/web dev

build: ## 构建所有项目
	pnpm build

docker-up: ## 启动 Docker 容器
	docker compose up -d

docker-down: ## 停止 Docker 容器
	docker compose down

docker-logs: ## 查看 Docker 日志
	docker compose logs -f

docker-rebuild: ## 重新构建 Docker 镜像
	docker compose build --no-cache

db-generate: ## 生成 Prisma Client
	pnpm --filter @lingxun/server exec prisma generate

db-migrate: ## 运行数据库迁移
	pnpm --filter @lingxun/server exec prisma migrate dev

db-push: ## 推送数据库 Schema
	pnpm --filter @lingxun/server exec prisma db push

db-seed: ## 填充种子数据
	pnpm --filter @lingxun/server exec prisma db seed

db-studio: ## 打开 Prisma Studio
	pnpm --filter @lingxun/server exec prisma studio

lint: ## 运行 ESLint
	pnpm lint

format: ## 运行 Prettier
	pnpm format

clean: ## 清理构建产物
	rm -rf apps/server/dist apps/web/.next apps/web/out packages/*/dist
