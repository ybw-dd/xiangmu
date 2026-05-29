import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('开始数据库种子数据...');

  // 创建测试用户
  const hashedPassword = await bcrypt.hash('Test123456', 12);

  const user1 = await prisma.user.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      username: 'admin',
      email: 'admin@lingxun.com',
      password: hashedPassword,
      nickname: '管理员',
      status: 'online',
    },
  });

  const user2 = await prisma.user.upsert({
    where: { username: 'testuser' },
    update: {},
    create: {
      username: 'testuser',
      email: 'test@lingxun.com',
      password: hashedPassword,
      nickname: '测试用户',
      status: 'offline',
    },
  });

  console.log(`已创建用户: ${user1.username}, ${user2.username}`);
  console.log('种子数据完成!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => {
    prisma.$disconnect();
  });
