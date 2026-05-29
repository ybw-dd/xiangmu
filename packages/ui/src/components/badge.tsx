/**
 * 未读消息数量徽章
 */
interface UnreadBadgeProps {
  count: number;
  max?: number;
}

export function UnreadBadge({ count, max = 99 }: UnreadBadgeProps) {
  if (count <= 0) return null;

  const display = count > max ? `${max}+` : String(count);

  return (
    <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 text-xs font-medium text-white bg-red-500 rounded-full">
      {display}
    </span>
  );
}
