import { Injectable, ForbiddenException, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class GroupService {
  private readonly logger = new Logger(GroupService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * 创建群组
   */
  async createGroup(data: {
    name: string;
    description?: string;
    ownerId: string;
    memberIds: string[];
  }) {
    const allMembers = Array.from(new Set([data.ownerId, ...data.memberIds]));

    // 先创建会话（含所有成员作为参与者）
    const conversation = await this.prisma.conversation.create({
      data: {
        type: 'group',
        name: data.name,
        participants: {
          create: allMembers.map((userId) => ({ userId })),
        },
      },
    });

    // 创建群组，关联会话
    const group = await this.prisma.group.create({
      data: {
        name: data.name,
        description: data.description,
        ownerId: data.ownerId,
        conversationId: conversation.id,
        members: {
          create: allMembers.map((userId) => ({
            userId,
            role: userId === data.ownerId ? 'owner' : 'member',
          })),
        },
      },
      include: {
        members: {
          include: {
            user: { select: { id: true, username: true, nickname: true, avatar: true } },
          },
        },
      },
    });

    this.logger.log(`群组已创建: ${group.name} (${group.id})`);
    return group;
  }

  /**
   * 获取用户的群组列表
   */
  async getUserGroups(userId: string) {
    return this.prisma.groupMember.findMany({
      where: { userId },
      include: {
        group: {
          include: {
            _count: { select: { members: true } },
          },
        },
      },
    });
  }

  /**
   * 获取群组详情
   */
  async getGroup(groupId: string) {
    return this.prisma.group.findUnique({
      where: { id: groupId },
      include: {
        members: {
          include: {
            user: { select: { id: true, username: true, nickname: true, avatar: true, status: true } },
          },
        },
      },
    });
  }

  /**
   * 更新群组设置
   */
  async updateGroup(
    groupId: string,
    data: { name?: string; description?: string; avatar?: string },
    operatorId: string,
  ) {
    // 检查权限（owner 或 admin）
    const member = await this.prisma.groupMember.findFirst({
      where: { groupId, userId: operatorId, role: { in: ['owner', 'admin'] } },
    });
    if (!member) {
      throw new ForbiddenException('无权修改群组设置');
    }

    const updated = await this.prisma.group.update({
      where: { id: groupId },
      data,
    });

    // 同步更新会话名称
    if (data.name) {
      await this.prisma.conversation.update({
        where: { id: updated.conversationId },
        data: { name: data.name },
      });
    }

    this.logger.log(`群组设置已更新: ${groupId}`);
    return updated;
  }

  /**
   * 添加成员
   */
  async addMember(groupId: string, userId: string, operatorId: string) {
    const operator = await this.prisma.groupMember.findFirst({
      where: { groupId, userId: operatorId, role: { in: ['owner', 'admin'] } },
    });
    if (!operator) {
      throw new ForbiddenException('无权添加成员');
    }

    // 检查是否已是成员
    const existing = await this.prisma.groupMember.findFirst({
      where: { groupId, userId },
    });
    if (existing) {
      throw new ForbiddenException('该用户已在群组中');
    }

    // 获取群组会话 ID
    const group = await this.prisma.group.findUnique({
      where: { id: groupId },
      select: { conversationId: true },
    });
    if (!group) throw new NotFoundException('群组不存在');

    // 同时创建 GroupMember 和 ConversationParticipant
    const [member] = await this.prisma.$transaction([
      this.prisma.groupMember.create({
        data: { groupId, userId, role: 'member' },
        include: {
          user: { select: { id: true, username: true, nickname: true, avatar: true } },
        },
      }),
      this.prisma.conversationParticipant.create({
        data: { conversationId: group.conversationId, userId },
      }),
    ]);

    this.logger.log(`成员已添加: ${userId} -> ${groupId}`);
    return member;
  }

  /**
   * 移除成员
   */
  async removeMember(groupId: string, userId: string, operatorId: string) {
    const operator = await this.prisma.groupMember.findFirst({
      where: { groupId, userId: operatorId, role: { in: ['owner', 'admin'] } },
    });
    if (!operator) {
      throw new ForbiddenException('无权移除成员');
    }

    // 不能移除 owner
    const target = await this.prisma.groupMember.findFirst({
      where: { groupId, userId },
    });
    if (target?.role === 'owner') {
      throw new ForbiddenException('不能移除群主');
    }

    // 获取群组会话 ID
    const group = await this.prisma.group.findUnique({
      where: { id: groupId },
      select: { conversationId: true },
    });

    // 同时删除 GroupMember 和 ConversationParticipant
    await this.prisma.$transaction([
      this.prisma.groupMember.deleteMany({ where: { groupId, userId } }),
      ...(group
        ? [this.prisma.conversationParticipant.deleteMany({
            where: { conversationId: group.conversationId, userId },
          })]
        : []),
    ]);

    this.logger.log(`成员已移除: ${userId} <- ${groupId}`);
  }

  /**
   * 退出群组
   */
  async leaveGroup(groupId: string, userId: string) {
    // 检查是否是 owner（owner 不能直接退出，需先转移或解散）
    const member = await this.prisma.groupMember.findFirst({
      where: { groupId, userId },
    });
    if (member?.role === 'owner') {
      throw new ForbiddenException('群主不能直接退出，请先转让群主或解散群组');
    }

    const group = await this.prisma.group.findUnique({
      where: { id: groupId },
      select: { conversationId: true },
    });

    await this.prisma.$transaction([
      this.prisma.groupMember.deleteMany({ where: { groupId, userId } }),
      ...(group
        ? [this.prisma.conversationParticipant.deleteMany({
            where: { conversationId: group.conversationId, userId },
          })]
        : []),
    ]);

    this.logger.log(`成员已退出: ${userId} <- ${groupId}`);
  }

  /**
   * 更新成员角色
   */
  async updateMemberRole(
    groupId: string,
    userId: string,
    newRole: 'admin' | 'member',
    operatorId: string,
  ) {
    // 仅 owner 可管理角色
    const operator = await this.prisma.groupMember.findFirst({
      where: { groupId, userId: operatorId, role: 'owner' },
    });
    if (!operator) {
      throw new ForbiddenException('仅群主可管理角色');
    }

    // 不能修改 owner 角色
    const target = await this.prisma.groupMember.findFirst({
      where: { groupId, userId },
    });
    if (!target) throw new NotFoundException('该用户不在群组中');
    if (target.role === 'owner') {
      throw new ForbiddenException('不能修改群主角色');
    }

    return this.prisma.groupMember.updateMany({
      where: { groupId, userId },
      data: { role: newRole },
    });
  }

  /**
   * 解散群组
   */
  async deleteGroup(groupId: string, operatorId: string) {
    // 仅 owner 可解散
    const group = await this.prisma.group.findUnique({
      where: { id: groupId },
    });
    if (!group) throw new NotFoundException('群组不存在');
    if (group.ownerId !== operatorId) {
      throw new ForbiddenException('仅群主可解散群组');
    }

    // 级联删除：GroupMember -> Group -> ConversationParticipant -> Conversation
    await this.prisma.$transaction([
      this.prisma.groupMember.deleteMany({ where: { groupId } }),
      this.prisma.group.delete({ where: { id: groupId } }),
      this.prisma.conversationParticipant.deleteMany({
        where: { conversationId: group.conversationId },
      }),
      this.prisma.conversation.delete({
        where: { id: group.conversationId },
      }),
    ]);

    this.logger.log(`群组已解散: ${groupId}`);
  }
}
