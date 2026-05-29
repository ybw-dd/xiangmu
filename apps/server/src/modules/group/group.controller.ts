import { Controller, Post, Get, Patch, Delete, Param, Body } from '@nestjs/common';
import { GroupService } from './group.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { JwtPayload } from '@lingxun/types';
import { IsString, IsOptional, IsArray, IsIn } from 'class-validator';

class CreateGroupDto {
  @IsString()
  declare name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsArray()
  @IsString({ each: true })
  declare memberIds: string[];
}

class UpdateGroupDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  avatar?: string;
}

class UpdateRoleDto {
  @IsString()
  @IsIn(['admin', 'member'])
  declare role: 'admin' | 'member';
}

@Controller('groups')
export class GroupController {
  constructor(private groupService: GroupService) {}

  @Post()
  async createGroup(@CurrentUser() user: JwtPayload, @Body() dto: CreateGroupDto) {
    return this.groupService.createGroup({
      ...dto,
      ownerId: user.sub,
    });
  }

  @Get()
  async getMyGroups(@CurrentUser() user: JwtPayload) {
    return this.groupService.getUserGroups(user.sub);
  }

  @Get(':id')
  async getGroup(@Param('id') id: string) {
    return this.groupService.getGroup(id);
  }

  @Patch(':id')
  async updateGroup(
    @Param('id') groupId: string,
    @Body() dto: UpdateGroupDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.groupService.updateGroup(groupId, dto, user.sub);
  }

  @Delete(':id')
  async deleteGroup(@Param('id') groupId: string, @CurrentUser() user: JwtPayload) {
    await this.groupService.deleteGroup(groupId, user.sub);
    return { success: true };
  }

  @Post(':id/members')
  async addMember(
    @Param('id') groupId: string,
    @Body('userId') userId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.groupService.addMember(groupId, userId, user.sub);
  }

  @Delete(':id/members/:userId')
  async removeMember(
    @Param('id') groupId: string,
    @Param('userId') userId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    await this.groupService.removeMember(groupId, userId, user.sub);
    return { success: true };
  }

  @Patch(':id/members/:userId/role')
  async updateMemberRole(
    @Param('id') groupId: string,
    @Param('userId') userId: string,
    @Body() dto: UpdateRoleDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.groupService.updateMemberRole(groupId, userId, dto.role, user.sub);
  }

  @Delete(':id/leave')
  async leaveGroup(@Param('id') groupId: string, @CurrentUser() user: JwtPayload) {
    await this.groupService.leaveGroup(groupId, user.sub);
    return { success: true };
  }
}
