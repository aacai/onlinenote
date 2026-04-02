import { Note, Category } from '@/types/note';
import { api } from './api';
import { storage } from './storage';

// 同步状态
interface SyncState {
  lastSyncAt: number;
  pendingChanges: PendingChange[];
  isOnline: boolean;
}

interface PendingChange {
  id: string;
  type: 'create' | 'update' | 'delete';
  entity: 'note' | 'category';
  data: Note | Category | { id: string };
  timestamp: number;
}

interface SyncResult {
  success: boolean;
  uploaded: number;
  downloaded: number;
  conflicts: SyncConflict[];
  errors: string[];
}

interface SyncConflict {
  entity: 'note' | 'category';
  id: string;
  localData: Note | Category;
  remoteData: Note | Category;
  resolution?: 'local' | 'remote' | 'merge';
}

const SYNC_KEY = 'markdown_sync_state';

// 获取同步状态
const getSyncState = (): SyncState => {
  if (typeof window === 'undefined') {
    return { lastSyncAt: 0, pendingChanges: [], isOnline: true };
  }
  const data = localStorage.getItem(SYNC_KEY);
  return data ? JSON.parse(data) : { lastSyncAt: 0, pendingChanges: [], isOnline: navigator.onLine };
};

// 保存同步状态
const saveSyncState = (state: SyncState): void => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(SYNC_KEY, JSON.stringify(state));
};

// 添加待处理变更
export const addPendingChange = (change: Omit<PendingChange, 'id' | 'timestamp'>): void => {
  const state = getSyncState();
  state.pendingChanges.push({
    ...change,
    id: `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    timestamp: Date.now(),
  });
  saveSyncState(state);
};

// 清除已处理的变更
const clearPendingChanges = (processedIds: string[]): void => {
  const state = getSyncState();
  state.pendingChanges = state.pendingChanges.filter(c => !processedIds.includes(c.id));
  saveSyncState(state);
};

// 检测网络状态
export const useNetworkStatus = (): boolean => {
  if (typeof window === 'undefined') return true;
  return navigator.onLine;
};

// 导出所有本地数据（用于迁移）
export const exportLocalData = (): { notes: Note[]; categories: Category[]; exportAt: number } => {
  return {
    notes: storage.getNotes(),
    categories: storage.getCategories(),
    exportAt: Date.now(),
  };
};

// 导入数据到本地
export const importLocalData = (data: { notes: Note[]; categories: Category[] }): void => {
  storage.saveNotes(data.notes);
  storage.saveCategories(data.categories);
};

// 同步本地数据到云端（首次迁移用）
export const syncToCloud = async (): Promise<SyncResult> => {
  const result: SyncResult = {
    success: true,
    uploaded: 0,
    downloaded: 0,
    conflicts: [],
    errors: [],
  };

  try {
    const localData = exportLocalData();
    
    // 获取云端现有数据
    const [remoteNotes, remoteCategories] = await Promise.all([
      api.getNotes(),
      api.getCategories(),
    ]);

    // 创建 ID 映射用于检测冲突
    const remoteNoteIds = new Set(remoteNotes.map(n => n.id));
    const remoteCategoryIds = new Set(remoteCategories.map(c => c.id));

    // 上传本地独有的笔记
    for (const note of localData.notes) {
      if (!remoteNoteIds.has(note.id)) {
        try {
          await api.createNote(note);
          result.uploaded++;
        } catch (error) {
          result.errors.push(`Failed to upload note ${note.id}: ${error}`);
        }
      } else {
        // 检测冲突：同一 ID 但内容不同
        const remoteNote = remoteNotes.find(n => n.id === note.id);
        if (remoteNote && remoteNote.updatedAt !== note.updatedAt) {
          result.conflicts.push({
            entity: 'note',
            id: note.id,
            localData: note,
            remoteData: remoteNote,
          });
        }
      }
    }

    // 上传本地独有的分类
    for (const category of localData.categories) {
      if (!remoteCategoryIds.has(category.id)) {
        try {
          await api.addCategory(category.name, category.color);
          result.uploaded++;
        } catch (error) {
          result.errors.push(`Failed to upload category ${category.id}: ${error}`);
        }
      }
    }

    // 更新同步时间
    const state = getSyncState();
    state.lastSyncAt = Date.now();
    saveSyncState(state);

    result.success = result.errors.length === 0;
    return result;
  } catch (error) {
    result.success = false;
    result.errors.push(`Sync failed: ${error}`);
    return result;
  }
};

// 从云端同步到本地
export const syncFromCloud = async (): Promise<SyncResult> => {
  const result: SyncResult = {
    success: true,
    uploaded: 0,
    downloaded: 0,
    conflicts: [],
    errors: [],
  };

  try {
    const [remoteNotes, remoteCategories] = await Promise.all([
      api.getNotes(),
      api.getCategories(),
    ]);

    const localData = exportLocalData();

    // 合并策略：远程优先，但保留本地独有的
    const mergedNotes = [...localData.notes];
    
    for (const remoteNote of remoteNotes) {
      const localIndex = mergedNotes.findIndex(n => n.id === remoteNote.id);
      if (localIndex === -1) {
        // 云端有新笔记，下载到本地
        mergedNotes.push(remoteNote);
        result.downloaded++;
      } else {
        // 检测冲突
        const localNote = mergedNotes[localIndex];
        if (localNote.updatedAt !== remoteNote.updatedAt) {
          // 使用较新的版本
          if (remoteNote.updatedAt > localNote.updatedAt) {
            mergedNotes[localIndex] = remoteNote;
            result.downloaded++;
          }
        }
      }
    }

    // 保存合并后的数据（去重）
    const uniqueNotes = mergedNotes.filter((note, index, self) =>
      index === self.findIndex(n => n.id === note.id)
    );
    const uniqueCategories = (remoteCategories.length > 0 ? remoteCategories : localData.categories).filter(
      (cat, index, self) => index === self.findIndex(c => c.id === cat.id)
    );
    importLocalData({
      notes: uniqueNotes,
      categories: uniqueCategories,
    });

    // 更新同步时间
    const state = getSyncState();
    state.lastSyncAt = Date.now();
    saveSyncState(state);

    return result;
  } catch (error) {
    result.success = false;
    result.errors.push(`Sync from cloud failed: ${error}`);
    return result;
  }
};

// 双向同步（完整同步）
export const bidirectionalSync = async (): Promise<SyncResult> => {
  const result: SyncResult = {
    success: true,
    uploaded: 0,
    downloaded: 0,
    conflicts: [],
    errors: [],
  };

  try {
    // 先获取云端现有数据，用于检测重复
    const remoteNotes = await api.getNotes();
    const remoteNoteIds = new Set(remoteNotes.map(n => n.id));

    // 先处理待上传的变更
    const state = getSyncState();
    const processedIds: string[] = [];

    for (const change of state.pendingChanges) {
      try {
        if (change.type === 'create') {
          if (change.entity === 'note') {
            const note = change.data as Note;
            // 如果云端已存在相同 id，改为更新操作
            if (remoteNoteIds.has(note.id)) {
              await api.updateNote(note.id, note);
            } else {
              await api.createNote(note);
            }
          } else {
            const cat = change.data as Category;
            await api.addCategory(cat.name, cat.color);
          }
        } else if (change.type === 'update') {
          const data = change.data as { id: string } & Partial<Note>;
          await api.updateNote(data.id, data);
        } else if (change.type === 'delete') {
          const data = change.data as { id: string };
          await api.deleteNote(data.id);
        }
        result.uploaded++;
        processedIds.push(change.id);
      } catch (error) {
        result.errors.push(`Failed to process change ${change.id}: ${error}`);
      }
    }

    clearPendingChanges(processedIds);

    // 然后从云端拉取最新数据
    const pullResult = await syncFromCloud();
    result.downloaded = pullResult.downloaded;
    result.conflicts = pullResult.conflicts;
    result.errors.push(...pullResult.errors);

    result.success = result.errors.length === 0;
    return result;
  } catch (error) {
    result.success = false;
    result.errors.push(`Bidirectional sync failed: ${error}`);
    return result;
  }
};

// 解决冲突
export const resolveConflict = async (
  conflict: SyncConflict,
  resolution: 'local' | 'remote' | 'merge'
): Promise<void> => {
  if (resolution === 'local') {
    // 使用本地数据覆盖云端
    if (conflict.entity === 'note') {
      await api.updateNote(conflict.id, conflict.localData as Note);
    }
  } else if (resolution === 'remote') {
    // 使用云端数据覆盖本地
    const localData = exportLocalData();
    if (conflict.entity === 'note') {
      const notes = localData.notes.map(n => 
        n.id === conflict.id ? (conflict.remoteData as Note) : n
      );
      importLocalData({ ...localData, notes });
    }
  } else if (resolution === 'merge') {
    // 合并数据（简单策略：合并内容，保留最新时间戳）
    const localNote = conflict.localData as Note;
    const remoteNote = conflict.remoteData as Note;
    const merged: Note = {
      ...remoteNote,
      content: `${localNote.content}\n\n---\n\n${remoteNote.content}`,
      updatedAt: Date.now(),
    };
    await api.updateNote(conflict.id, merged);
    const localData = exportLocalData();
    const notes = localData.notes.map(n => 
      n.id === conflict.id ? merged : n
    );
    importLocalData({ ...localData, notes });
  }
};

// 自动同步（带防抖）
let syncTimeout: NodeJS.Timeout | null = null;

export const scheduleSync = (delay: number = 5000): void => {
  if (syncTimeout) {
    clearTimeout(syncTimeout);
  }
  syncTimeout = setTimeout(() => {
    if (navigator.onLine) {
      bidirectionalSync().then(result => {
        if (result.conflicts.length > 0) {
          console.warn('Sync conflicts detected:', result.conflicts);
        }
      });
    }
  }, delay);
};

// 监听网络状态变化
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    console.log('Network is online, syncing...');
    bidirectionalSync();
  });
  
  window.addEventListener('offline', () => {
    console.log('Network is offline, changes will be queued');
  });
}
