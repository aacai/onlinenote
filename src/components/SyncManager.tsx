'use client';

import React, { useState, useCallback, useSyncExternalStore } from 'react';
import { 
  Cloud, 
  CloudOff, 
  Upload, 
  Download, 
  RefreshCw, 
  CheckCircle, 
  AlertCircle,
  FileJson,
  AlertTriangle,
  X
} from 'lucide-react';
import { 
  syncToCloud, 
  syncFromCloud, 
  bidirectionalSync, 
  exportLocalData, 
  importLocalData,
  resolveConflict,
} from '@/lib/sync';
import { Note, Category } from '@/types/note';

interface SyncManagerProps {
  isOpen: boolean;
  onClose: () => void;
}

interface SyncConflictItem {
  entity: 'note' | 'category';
  id: string;
  localData: Note | Category;
  remoteData: Note | Category;
}

// 使用 useSyncExternalStore 检测在线状态 (React 19 推荐方式)
const getOnlineStatus = () => typeof navigator !== 'undefined' ? navigator.onLine : true;
const getServerOnlineStatus = () => true;
const subscribeOnlineStatus = (callback: () => void) => {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener('online', callback);
  window.addEventListener('offline', callback);
  return () => {
    window.removeEventListener('online', callback);
    window.removeEventListener('offline', callback);
  };
};

export function SyncManager({ isOpen, onClose }: SyncManagerProps) {
  const isOnline = useSyncExternalStore(subscribeOnlineStatus, getOnlineStatus, getServerOnlineStatus);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [syncResult, setSyncResult] = useState<{
    type: 'success' | 'error' | 'info';
    message: string;
    details?: { uploaded?: number; downloaded?: number; conflicts?: number };
  } | null>(null);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importData, setImportData] = useState('');
  const [conflicts, setConflicts] = useState<SyncConflictItem[]>([]);

  const handleClose = useCallback(() => {
    setIsClosing(true);
    setTimeout(() => {
      setIsClosing(false);
      onClose();
    }, 200);
  }, [onClose]);

  const handleSyncToCloud = useCallback(async () => {
    if (!isOnline) {
      setSyncResult({ type: 'error', message: '当前处于离线状态，无法同步到云端' });
      return;
    }
    
    setIsSyncing(true);
    setSyncResult({ type: 'info', message: '正在上传数据到云端...' });
    
    try {
      const result = await syncToCloud();
      
      if (result.conflicts.length > 0) {
        setConflicts(result.conflicts as SyncConflictItem[]);
        setSyncResult({
          type: 'info',
          message: `发现 ${result.conflicts.length} 个冲突需要解决`,
          details: { conflicts: result.conflicts.length }
        });
      } else if (result.success) {
        setSyncResult({
          type: 'success',
          message: '数据已成功上传到云端',
          details: { uploaded: result.uploaded }
        });
      } else {
        setSyncResult({
          type: 'error',
          message: `同步失败: ${result.errors.join(', ')}`
        });
      }
    } catch (error) {
      setSyncResult({ type: 'error', message: `同步出错: ${String(error)}` });
    } finally {
      setIsSyncing(false);
    }
  }, [isOnline]);

  const handleSyncFromCloud = useCallback(async () => {
    if (!isOnline) {
      setSyncResult({ type: 'error', message: '当前处于离线状态，无法从云端同步' });
      return;
    }
    
    setIsSyncing(true);
    setSyncResult({ type: 'info', message: '正在从云端下载数据...' });
    
    try {
      const result = await syncFromCloud();
      
      if (result.success) {
        setSyncResult({
          type: 'success',
          message: '数据已成功从云端同步到本地',
          details: { downloaded: result.downloaded }
        });
        // 刷新页面以显示新数据
        setTimeout(() => window.location.reload(), 1500);
      } else {
        setSyncResult({
          type: 'error',
          message: `同步失败: ${result.errors.join(', ')}`
        });
      }
    } catch (error) {
      setSyncResult({ type: 'error', message: `同步出错: ${String(error)}` });
    } finally {
      setIsSyncing(false);
    }
  }, [isOnline]);

  const handleBidirectionalSync = useCallback(async () => {
    if (!isOnline) {
      setSyncResult({ type: 'error', message: '当前处于离线状态，无法同步' });
      return;
    }
    
    setIsSyncing(true);
    setSyncResult({ type: 'info', message: '正在进行双向同步...' });
    
    try {
      const result = await bidirectionalSync();
      
      if (result.conflicts.length > 0) {
        setConflicts(result.conflicts as SyncConflictItem[]);
        setSyncResult({
          type: 'info',
          message: `同步完成，发现 ${result.conflicts.length} 个冲突`,
          details: { 
            uploaded: result.uploaded, 
            downloaded: result.downloaded,
            conflicts: result.conflicts.length 
          }
        });
      } else if (result.success) {
        setSyncResult({
          type: 'success',
          message: '双向同步完成',
          details: { uploaded: result.uploaded, downloaded: result.downloaded }
        });
        setTimeout(() => window.location.reload(), 1500);
      } else {
        setSyncResult({
          type: 'error',
          message: `同步失败: ${result.errors.join(', ')}`
        });
      }
    } catch (error) {
      setSyncResult({ type: 'error', message: `同步出错: ${String(error)}` });
    } finally {
      setIsSyncing(false);
    }
  }, [isOnline]);

  const handleExport = useCallback(() => {
    const data = exportLocalData();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `notes_backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setShowExportModal(false);
    setSyncResult({ type: 'success', message: '数据已导出' });
  }, []);

  const handleImport = useCallback(() => {
    try {
      const data = JSON.parse(importData);
      if (data.notes && data.categories) {
        importLocalData(data);
        setShowImportModal(false);
        setImportData('');
        setSyncResult({ type: 'success', message: '数据已导入，即将刷新页面...' });
        setTimeout(() => window.location.reload(), 1500);
      } else {
        setSyncResult({ type: 'error', message: '无效的数据格式' });
      }
    } catch {
      setSyncResult({ type: 'error', message: '解析数据失败' });
    }
  }, [importData]);

  const handleResolveConflict = useCallback(async (conflict: SyncConflictItem, resolution: 'local' | 'remote' | 'merge') => {
    await resolveConflict(conflict, resolution);
    setConflicts(prev => prev.filter(c => c.id !== conflict.id));
    if (conflicts.length <= 1) {
      setSyncResult({ type: 'success', message: '所有冲突已解决' });
      setTimeout(() => window.location.reload(), 1500);
    }
  }, [conflicts]);

  const getNoteTitle = (data: Note | Category): string => {
    if ('title' in data) {
      return data.title;
    }
    return data.name;
  };

  if (!isOpen) return null;

  return (
    <>
      {/* 主弹窗 */}
      <div 
        className="fixed inset-0 z-50 flex items-center justify-center p-4 transition-all duration-200 ease-out"
        style={{ 
          backgroundColor: 'rgba(0, 0, 0, 0.3)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          animation: isClosing ? 'dialogFadeOut 0.2s ease-out forwards' : 'dialogFadeIn 0.2s ease-out'
        }}
        onClick={handleClose}
      >
        <div 
          className="bg-white/90 dark:bg-gray-800/90 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden border border-white/20 dark:border-gray-700/50 transition-all duration-200 ease-out flex flex-col"
          style={{ 
            animation: isClosing ? 'dialogScaleOut 0.2s ease-out forwards' : 'dialogScaleIn 0.2s ease-out'
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* 弹窗头部 */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                <Cloud className="w-5 h-5 text-blue-500" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  数据同步
                </h3>
                <p className="text-sm text-gray-500">
                  {isOnline ? '已连接到云端' : '离线模式'}
                </p>
              </div>
            </div>
            <button
              onClick={handleClose}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>

          {/* 弹窗内容 */}
          <div className="p-6 overflow-y-auto">
            {/* 状态指示器 */}
            <div className="flex items-center gap-3 p-4 rounded-xl bg-gray-50 dark:bg-gray-800/50 mb-6">
              {isOnline ? (
                <Cloud className="w-6 h-6 text-green-500" />
              ) : (
                <CloudOff className="w-6 h-6 text-gray-400" />
              )}
              <div>
                <p className="font-medium text-gray-900 dark:text-white">
                  {isOnline ? '已连接到云端' : '离线模式'}
                </p>
                <p className="text-sm text-gray-500">
                  {isOnline ? '可以进行数据同步' : '变更将在联网后自动同步'}
                </p>
              </div>
            </div>

            {/* 同步操作按钮 */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              <button
                onClick={handleSyncToCloud}
                disabled={!isOnline || isSyncing}
                className="flex items-center justify-center gap-2 p-4 rounded-xl border-2 border-dashed border-blue-300 hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Upload className="w-5 h-5" />
                <span className="font-medium">上传到云端</span>
              </button>
              
              <button
                onClick={handleSyncFromCloud}
                disabled={!isOnline || isSyncing}
                className="flex items-center justify-center gap-2 p-4 rounded-xl border-2 border-dashed border-green-300 hover:border-green-500 hover:bg-green-50 dark:hover:bg-green-900/20 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Download className="w-5 h-5" />
                <span className="font-medium">从云端下载</span>
              </button>
            </div>

            <button
              onClick={handleBidirectionalSync}
              disabled={!isOnline || isSyncing}
              className="w-full flex items-center justify-center gap-2 p-4 rounded-xl bg-blue-500 text-white hover:bg-blue-600 active:bg-blue-700 transition-all duration-200 font-medium shadow-lg shadow-blue-500/30 disabled:opacity-50 disabled:cursor-not-allowed mb-6"
            >
              <RefreshCw className={`w-5 h-5 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>{isSyncing ? '同步中...' : '双向同步'}</span>
            </button>

            {/* 数据迁移工具 */}
            <div className="border-t border-gray-200 dark:border-gray-700 pt-6 mb-6">
              <h4 className="font-medium text-gray-900 dark:text-white mb-4">数据迁移工具</h4>
              <div className="flex gap-4">
                <button
                  onClick={() => setShowExportModal(true)}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all duration-200 font-medium"
                >
                  <FileJson className="w-4 h-4" />
                  导出数据
                </button>
                <button
                  onClick={() => setShowImportModal(true)}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all duration-200 font-medium"
                >
                  <FileJson className="w-4 h-4" />
                  导入数据
                </button>
              </div>
            </div>

            {/* 同步结果提示 */}
            {syncResult && (
              <div className={`p-4 rounded-xl flex items-start gap-3 ${
                syncResult.type === 'success' ? 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400' :
                syncResult.type === 'error' ? 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400' :
                'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400'
              }`}>
                {syncResult.type === 'success' ? <CheckCircle className="w-5 h-5 flex-shrink-0" /> :
                 syncResult.type === 'error' ? <AlertCircle className="w-5 h-5 flex-shrink-0" /> :
                 <RefreshCw className="w-5 h-5 flex-shrink-0 animate-spin" />}
                <div>
                  <p className="font-medium">{syncResult.message}</p>
                  {syncResult.details && (
                    <div className="mt-1 text-sm opacity-80">
                      {syncResult.details.uploaded !== undefined && (
                        <p>上传: {syncResult.details.uploaded} 项</p>
                      )}
                      {syncResult.details.downloaded !== undefined && (
                        <p>下载: {syncResult.details.downloaded} 项</p>
                      )}
                      {syncResult.details.conflicts !== undefined && (
                        <p>冲突: {syncResult.details.conflicts} 项</p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 冲突解决面板 */}
            {conflicts.length > 0 && (
              <div className="border-t border-gray-200 dark:border-gray-700 pt-6 mt-6">
                <div className="flex items-center gap-2 mb-4 text-amber-600">
                  <AlertTriangle className="w-5 h-5" />
                  <h4 className="font-medium">需要解决的冲突 ({conflicts.length})</h4>
                </div>
                <div className="space-y-4">
                  {conflicts.map(conflict => (
                    <div key={conflict.id} className="p-4 rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-900/10 dark:border-amber-800">
                      <p className="font-medium mb-2 text-gray-900 dark:text-white">
                        {conflict.entity === 'note' ? '笔记' : '分类'}: {getNoteTitle(conflict.localData)}
                      </p>
                      <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
                        <div>
                          <p className="text-gray-500">本地版本</p>
                          <p className="text-gray-700 dark:text-gray-300">
                            {'updatedAt' in conflict.localData
                              ? new Date(conflict.localData.updatedAt).toLocaleString()
                              : '无时间信息'}
                          </p>
                        </div>
                        <div>
                          <p className="text-gray-500">云端版本</p>
                          <p className="text-gray-700 dark:text-gray-300">
                            {'updatedAt' in conflict.remoteData
                              ? new Date(conflict.remoteData.updatedAt).toLocaleString()
                              : '无时间信息'}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleResolveConflict(conflict, 'local')}
                          className="px-3 py-1.5 text-sm rounded-lg bg-blue-500 text-white hover:bg-blue-600 transition-colors"
                        >
                          使用本地
                        </button>
                        <button
                          onClick={() => handleResolveConflict(conflict, 'remote')}
                          className="px-3 py-1.5 text-sm rounded-lg bg-green-500 text-white hover:bg-green-600 transition-colors"
                        >
                          使用云端
                        </button>
                        <button
                          onClick={() => handleResolveConflict(conflict, 'merge')}
                          className="px-3 py-1.5 text-sm rounded-lg bg-amber-500 text-white hover:bg-amber-600 transition-colors"
                        >
                          合并
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 导出确认弹窗 */}
      {showExportModal && (
        <div 
          className="fixed inset-0 z-[60] flex items-center justify-center p-4"
          style={{ 
            backgroundColor: 'rgba(0, 0, 0, 0.4)',
            backdropFilter: 'blur(8px)',
          }}
        >
          <div className="bg-white/90 dark:bg-gray-800/90 rounded-2xl shadow-2xl max-w-sm w-full p-6 border border-white/20 dark:border-gray-700/50">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                <FileJson className="w-5 h-5 text-blue-500" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                导出数据
              </h3>
            </div>
            <p className="text-gray-600 dark:text-gray-400 mb-6 leading-relaxed">
              这将导出所有笔记和分类数据为一个 JSON 文件，你可以用它作为备份或迁移到其他设备。
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowExportModal(false)}
                className="px-4 py-2.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-600 transition-all duration-200 font-medium"
              >
                取消
              </button>
              <button
                onClick={handleExport}
                className="px-4 py-2.5 bg-blue-500 text-white rounded-xl hover:bg-blue-600 active:bg-blue-700 transition-all duration-200 font-medium shadow-lg shadow-blue-500/30"
              >
                确认导出
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 导入弹窗 */}
      {showImportModal && (
        <div 
          className="fixed inset-0 z-[60] flex items-center justify-center p-4"
          style={{ 
            backgroundColor: 'rgba(0, 0, 0, 0.4)',
            backdropFilter: 'blur(8px)',
          }}
        >
          <div className="bg-white/90 dark:bg-gray-800/90 rounded-2xl shadow-2xl max-w-lg w-full p-6 border border-white/20 dark:border-gray-700/50">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                <FileJson className="w-5 h-5 text-blue-500" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                导入数据
              </h3>
            </div>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              粘贴之前导出的 JSON 数据，这将覆盖当前的本地数据。
            </p>
            <textarea
              value={importData}
              onChange={(e) => setImportData(e.target.value)}
              placeholder="在此粘贴 JSON 数据..."
              className="w-full h-48 p-3 rounded-xl border border-gray-300 dark:border-gray-600 resize-none font-mono text-sm bg-white dark:bg-gray-900"
            />
            <div className="flex gap-3 justify-end mt-4">
              <button
                onClick={() => {
                  setShowImportModal(false);
                  setImportData('');
                }}
                className="px-4 py-2.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-600 transition-all duration-200 font-medium"
              >
                取消
              </button>
              <button
                onClick={handleImport}
                disabled={!importData.trim()}
                className="px-4 py-2.5 bg-blue-500 text-white rounded-xl hover:bg-blue-600 active:bg-blue-700 transition-all duration-200 font-medium shadow-lg shadow-blue-500/30 disabled:opacity-50"
              >
                确认导入
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
