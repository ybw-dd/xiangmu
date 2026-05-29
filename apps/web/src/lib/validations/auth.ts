import { z } from 'zod';

/**
 * 登录表单验证
 */
export const loginSchema = z.object({
  username: z
    .string()
    .min(1, '请输入用户名或邮箱')
    .max(50, '用户名过长'),
  password: z
    .string()
    .min(1, '请输入密码'),
});

export type LoginFormData = z.infer<typeof loginSchema>;

/**
 * 注册表单验证
 */
export const registerSchema = z
  .object({
    username: z
      .string()
      .min(3, '用户名至少 3 个字符')
      .max(20, '用户名最多 20 个字符')
      .regex(/^[a-zA-Z0-9_]+$/, '用户名只能包含字母、数字和下划线'),
    email: z
      .string()
      .email('请输入有效的邮箱地址'),
    nickname: z
      .string()
      .max(20, '昵称最多 20 个字符')
      .optional()
      .or(z.literal('')),
    password: z
      .string()
      .min(8, '密码至少 8 位')
      .max(64, '密码最多 64 位')
      .regex(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
        '密码必须包含大小写字母和数字',
      ),
    confirmPassword: z.string().min(1, '请确认密码'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: '两次密码输入不一致',
    path: ['confirmPassword'],
  });

export type RegisterFormData = z.infer<typeof registerSchema>;

/**
 * 修改密码表单验证
 */
export const changePasswordSchema = z
  .object({
    oldPassword: z.string().min(1, '请输入原密码'),
    newPassword: z
      .string()
      .min(8, '密码至少 8 位')
      .max(64, '密码最多 64 位')
      .regex(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
        '密码必须包含大小写字母和数字',
      ),
    confirmNewPassword: z.string().min(1, '请确认新密码'),
  })
  .refine((data) => data.newPassword === data.confirmNewPassword, {
    message: '两次密码输入不一致',
    path: ['confirmNewPassword'],
  });

export type ChangePasswordFormData = z.infer<typeof changePasswordSchema>;

/**
 * 用户资料更新验证
 */
export const updateProfileSchema = z.object({
  nickname: z
    .string()
    .max(20, '昵称最多 20 个字符')
    .optional()
    .or(z.literal('')),
});

export type UpdateProfileFormData = z.infer<typeof updateProfileSchema>;
