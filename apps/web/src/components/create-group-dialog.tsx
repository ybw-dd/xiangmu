'use client';

import { useState } from 'react';
import { useCreateGroup, useFriends } from '@/features/group/hooks';

interface CreateGroupDialogProps {
  open: boolean;
  onClose: () => void;
}

export function CreateGroupDialog({ open, onClose }: CreateGroupDialogProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const { data: friends = [], isLoading: friendsLoading } = useFriends();
  const createGroup = useCreateGroup();

  if (!open) return null;

  const toggleFriend = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleSubmit = async () => {
    if (!name.trim() || selectedIds.size === 0) return;

    try {
      await createGroup.mutateAsync({
        name: name.trim(),
        description: description.trim() || undefined,
        memberIds: Array.from(selectedIds),
      });
      setName('');
      setDescription('');
      setSelectedIds(new Set());
      onClose();
    } catch {
      // 错误由 mutation 处理
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md bg-card rounded-xl shadow-lg p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">创建群组</h2>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            ✕
          </button>
        </div>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">群组名称 *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="输入群组名称"
              className="w-full px-3 py-2.5 border rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">群组描述</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="可选"
              className="w-full px-3 py-2.5 border rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">选择成员 ({selectedIds.size} 人)</label>
            <div className="max-h-48 overflow-y-auto border rounded-lg">
              {friendsLoading ? (
                <div className="p-4 text-center text-sm text-muted-foreground">加载中...</div>
              ) : friends.length === 0 ? (
                <div className="p-4 text-center text-sm text-muted-foreground">暂无好友</div>
              ) : (
                friends.map((friend) => (
                  <label
                    key={friend.id}
                    className="flex items-center gap-3 p-3 hover:bg-accent cursor-pointer border-b last:border-b-0"
                  >
                    <input
                      type="checkbox"
                      checked={selectedIds.has(friend.id)}
                      onChange={() => toggleFriend(friend.id)}
                      className="rounded"
                    />
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium">
                      {(friend.nickname || friend.username).slice(0, 2)}
                    </div>
                    <span className="text-sm">{friend.nickname || friend.username}</span>
                  </label>
                ))
              )}
            </div>
          </div>
        </div>

        {createGroup.error && (
          <p className="text-xs text-destructive">
            {createGroup.error instanceof Error ? createGroup.error.message : '创建失败'}
          </p>
        )}

        <div className="flex gap-2 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm border rounded-lg hover:bg-accent transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleSubmit}
            disabled={!name.trim() || selectedIds.size === 0 || createGroup.isPending}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {createGroup.isPending ? '创建中...' : '创建'}
          </button>
        </div>
      </div>
    </div>
  );
}
