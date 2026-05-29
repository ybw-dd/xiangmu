/**
 * 用户头像组件 - 显示在线状态指示
 */
import type { UserStatus } from '@lingxun/types';

interface AvatarProps {
  src?: string | null;
  name: string;
  size?: 'sm' | 'md' | 'lg';
  status?: UserStatus;
}

const sizeMap = {
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-12 h-12 text-base',
};

const statusColorMap: Record<string, string> = {
  online: 'bg-green-500',
  offline: 'bg-gray-400',
  away: 'bg-yellow-500',
  busy: 'bg-red-500',
};

export function Avatar({ src, name, size = 'md', status }: AvatarProps) {
  const initials = name.slice(0, 2).toUpperCase();
  const sizeClass = sizeMap[size];

  return (
    <div className="relative inline-flex">
      {src ? (
        <img
          src={src}
          alt={name}
          className={`${sizeClass} rounded-full object-cover`}
        />
      ) : (
        <div
          className={`${sizeClass} rounded-full bg-primary flex items-center justify-center text-primary-foreground font-medium`}
        >
          {initials}
        </div>
      )}
      {status && (
        <span
          className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-background ${statusColorMap[status]}`}
        />
      )}
    </div>
  );
}
