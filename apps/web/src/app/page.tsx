'use client';

import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8">
      <div className="text-center space-y-6">
        <h1 className="text-5xl font-bold tracking-tight">
          灵讯
          <span className="text-primary ml-2">LingXun</span>
        </h1>
        <p className="text-xl text-muted-foreground max-w-md mx-auto">
          工业级实时即时通讯系统
        </p>
        <div className="flex gap-4 justify-center pt-4">
          <Link
            href="/login"
            className="px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors font-medium"
          >
            登录
          </Link>
          <Link
            href="/register"
            className="px-6 py-3 bg-secondary text-secondary-foreground rounded-lg hover:bg-secondary/80 transition-colors font-medium"
          >
            注册
          </Link>
        </div>
      </div>

      <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl">
        <FeatureCard
          title="实时通信"
          description="基于 WebSocket 的实时消息传输，支持心跳检测和自动重连机制"
        />
        <FeatureCard
          title="消息可靠性"
          description="ACK 确认机制 + 消息序列号，确保消息不丢失、不乱序"
        />
        <FeatureCard
          title="AI 能力"
          description="集成 AI 助手，支持群聊总结、智能翻译、多模态理解"
        />
      </div>
    </main>
  );
}

function FeatureCard({ title, description }: { title: string; description: string }) {
  return (
    <div className="p-6 rounded-lg border bg-card text-card-foreground">
      <h3 className="font-semibold text-lg mb-2">{title}</h3>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
  );
}
