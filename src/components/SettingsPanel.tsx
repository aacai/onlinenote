'use client';

import { useState, useCallback, useSyncExternalStore, useEffect, useRef } from 'react';
import { X, Database, HardDrive, Check, AlertCircle, RefreshCw, Terminal, Copy, Trash2, Server, Leaf } from 'lucide-react';
import { setStorageMode, getStorageMode, StorageMode } from '@/lib/storageConfig';
import { checkSupabaseConnection, getConnectionLogs, clearConnectionLogs, ConnectionLog } from '@/lib/supabase';
import { checkRedisConnection, getRedisLogs, clearRedisLogs, RedisLog } from '@/lib/redis';
import { checkMongoDBConnection, getMongoDBLogs, clearMongoDBLogs, MongoDBLog } from '@/lib/mongodb';

interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

// 使用 useSyncExternalStore 获取存储模式
const subscribeStorageMode = (callback: () => void) => {
  if (typeof window !== 'undefined') {
    window.addEventListener('storageModeChange', callback);
    return () => window.removeEventListener('storageModeChange', callback);
  }
  return () => {};
};

const getStorageModeSnapshot = (): StorageMode => {
  if (typeof window === 'undefined') return 'local';
  return getStorageMode();
};

const getServerSnapshot = (): StorageMode => 'local';

// 格式化时间戳
const formatTime = (timestamp: number): string => {
  const date = new Date(timestamp);
  return date.toLocaleTimeString('zh-CN', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    fractionalSecondDigits: 3
  });
};

// 获取日志级别颜色
const getLogLevelColor = (level: ConnectionLog['level'] | RedisLog['level'] | MongoDBLog['level']): string => {
  switch (level) {
    case 'info':
      return 'text-blue-600 dark:text-blue-400';
    case 'warn':
      return 'text-amber-600 dark:text-amber-400';
    case 'error':
      return 'text-red-600 dark:text-red-400';
    case 'success':
      return 'text-green-600 dark:text-green-400';
    default:
      return 'text-gray-600 dark:text-gray-400';
  }
};

// 获取日志级别背景色
const getLogLevelBgColor = (level: ConnectionLog['level'] | RedisLog['level'] | MongoDBLog['level']): string => {
  switch (level) {
    case 'info':
      return 'bg-blue-100 dark:bg-blue-900/30';
    case 'warn':
      return 'bg-amber-100 dark:bg-amber-900/30';
    case 'error':
      return 'bg-red-100 dark:bg-red-900/30';
    case 'success':
      return 'bg-green-100 dark:bg-green-900/30';
    default:
      return 'bg-gray-100 dark:bg-gray-700';
  }
};

export function SettingsPanel({ isOpen, onClose }: SettingsPanelProps) {
  const currentMode = useSyncExternalStore(
    subscribeStorageMode,
    getStorageModeSnapshot,
    getServerSnapshot
  );
  const [isClosing, setIsClosing] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<boolean | null>(null);
  const [showRestartHint, setShowRestartHint] = useState(false);
  const [selectedMode, setSelectedMode] = useState<StorageMode>(currentMode);
  const [logs, setLogs] = useState<(ConnectionLog | RedisLog | MongoDBLog)[]>([]);
  const [showLogs, setShowLogs] = useState(false);
  const [copied, setCopied] = useState(false);
  const [activeProvider, setActiveProvider] = useState<'supabase' | 'redis' | 'mongodb' | null>(null);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const logsContainerRef = useRef<HTMLDivElement>(null);
  const userScrolledUpRef = useRef(false);

  const scrollToBottom = () => {
    const container = logsContainerRef.current;
    if (!container) return;
    container.scrollTop = container.scrollHeight;
  };

  const handleLogsScroll = useCallback(() => {
    const container = logsContainerRef.current;
    if (!container) return;
    const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
    userScrolledUpRef.current = distanceFromBottom > 100;
  }, []);

  // 更新日志
  const updateLogs = useCallback(() => {
    if (activeProvider === 'supabase') {
      setLogs(getConnectionLogs());
    } else if (activeProvider === 'redis') {
      setLogs(getRedisLogs());
    } else if (activeProvider === 'mongodb') {
      setLogs(getMongoDBLogs());
    }
  }, [activeProvider]);

  // 定期更新日志
  useEffect(() => {
    if (!showLogs || !activeProvider) return;

    // 使用 requestAnimationFrame 避免同步 setState
    const timeoutId = setTimeout(() => {
      updateLogs();
    }, 0);

    const interval = setInterval(updateLogs, 500);
    return () => {
      clearTimeout(timeoutId);
      clearInterval(interval);
    };
  }, [showLogs, activeProvider, updateLogs]);

  // 日志更新时自动滚动（仅当用户在底部附近时）
  useEffect(() => {
    if (showLogs && logs.length > 0 && !userScrolledUpRef.current) {
      scrollToBottom();
    }
  }, [logs, showLogs]);

  const handleClose = useCallback(() => {
    setIsClosing(true);
    setTimeout(() => {
      onClose();
      setIsClosing(false);
    }, 200);
  }, [onClose]);

  const handleModeChange = async (mode: StorageMode) => {
    if (mode === selectedMode) return;

    if (mode === 'supabase') {
      setIsChecking(true);
      setActiveProvider('supabase');
      const isConnected = await checkSupabaseConnection();
      setIsChecking(false);
      setConnectionStatus(isConnected);
      updateLogs();

      if (!isConnected) {
        return;
      }
    } else if (mode === 'redis') {
      setIsChecking(true);
      setActiveProvider('redis');
      const isConnected = await checkRedisConnection();
      setIsChecking(false);
      setConnectionStatus(isConnected);
      updateLogs();

      if (!isConnected) {
        return;
      }
    } else if (mode === 'mongodb') {
      setIsChecking(true);
      setActiveProvider('mongodb');
      const isConnected = await checkMongoDBConnection();
      setIsChecking(false);
      setConnectionStatus(isConnected);
      updateLogs();

      if (!isConnected) {
        return;
      }
    }

    setSelectedMode(mode);
    setStorageMode(mode);
    setShowRestartHint(true);
  };

  const handleRefresh = () => {
    window.location.reload();
  };

  const handleTestConnection = async (provider: 'supabase' | 'redis' | 'mongodb') => {
    setIsChecking(true);
    setShowLogs(true);
    setActiveProvider(provider);

    if (provider === 'supabase') {
      const isConnected = await checkSupabaseConnection();
      setIsChecking(false);
      setConnectionStatus(isConnected);
    } else if (provider === 'redis') {
      const isConnected = await checkRedisConnection();
      setIsChecking(false);
      setConnectionStatus(isConnected);
    } else if (provider === 'mongodb') {
      const isConnected = await checkMongoDBConnection();
      setIsChecking(false);
      setConnectionStatus(isConnected);
    }

    updateLogs();
  };

  const handleCopyLogs = async () => {
    const logText = logs.map(log =>
      `[${formatTime(log.timestamp)}] [${log.level.toUpperCase()}] ${log.message}${log.details ? '\n  ' + log.details : ''}`
    ).join('\n');

    try {
      await navigator.clipboard.writeText(logText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('复制失败:', err);
    }
  };

  const handleClearLogs = () => {
    if (activeProvider === 'supabase') {
      clearConnectionLogs();
    } else if (activeProvider === 'redis') {
      clearRedisLogs();
    } else if (activeProvider === 'mongodb') {
      clearMongoDBLogs();
    }
    updateLogs();
  };

  if (!isOpen) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4 transition-all duration-200 ease-out"
        style={{
          backgroundColor: 'rgba(0, 0, 0, 0.3)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          animation: isClosing ? 'dialogFadeOut 0.2s ease-out forwards' : 'dialogFadeIn 0.2s ease-out',
        }}
        onClick={handleClose}
      >
        <div
          className="bg-white/90 dark:bg-gray-800/90 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden border border-white/20 dark:border-gray-700/50 transition-all duration-200 ease-out flex flex-col"
          style={{
            animation: isClosing ? 'dialogScaleOut 0.2s ease-out forwards' : 'dialogScaleIn 0.2s ease-out',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">存储设置</h2>
            <button
              onClick={handleClose}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              <X size={20} className="text-gray-500 dark:text-gray-400" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6 space-y-6 overflow-y-auto">
            {/* 存储模式选择 */}
            <div className="space-y-4 rounded-xl bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 p-5 border border-blue-100 dark:border-blue-900/40">
              <div className="flex items-center gap-2.5 mb-1">
                <div className="w-8 h-8 rounded-lg bg-blue-500 flex items-center justify-center">
                  <Database size={16} className="text-white" />
                </div>
                <h3 className="text-base font-semibold text-gray-800 dark:text-gray-100">选择存储方式</h3>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 ml-10 -mt-1">当前：<span className={`font-medium ${selectedMode === 'local' ? 'text-gray-700 dark:text-gray-300' : 'text-blue-600 dark:text-blue-400'}`}>{selectedMode === 'local' ? '📁 本地存储' : selectedMode === 'supabase' ? '🐘 Supabase' : selectedMode === 'redis' ? '⚡ Redis' : '🍃 MongoDB'}</span></p>

              {/* 本地存储选项 */}
              <button
                onClick={() => handleModeChange('local')}
                className={`w-full flex items-start gap-4 p-4 rounded-xl border-2 transition-all duration-200 text-left ${
                  selectedMode === 'local'
                    ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-900/20'
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                }`}
              >
                <div className={`p-3 rounded-lg ${
                  selectedMode === 'local'
                    ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                }`}>
                  <HardDrive size={24} />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900 dark:text-white">本地存储</span>
                    {selectedMode === 'local' && (
                      <Check size={16} className="text-blue-500" />
                    )}
                  </div>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    所有数据存储在本地浏览器和服务器文件中，无需外部服务
                  </p>
                  <div className="flex flex-wrap gap-2 mt-3">
                    <span className="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded">
                      笔记 → 本地文件
                    </span>
                    <span className="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded">
                      附件 → 本地文件
                    </span>
                  </div>
                </div>
              </button>

              {/* Supabase 选项 */}
              <div className={`rounded-xl border-2 transition-all duration-200 ${
                selectedMode === 'supabase'
                  ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-900/20'
                  : 'border-gray-200 dark:border-gray-700'
              }`}>
                <button
                  onClick={() => handleModeChange('supabase')}
                  className="w-full flex items-start gap-4 p-4 text-left"
                >
                  <div className={`p-3 rounded-lg ${
                    selectedMode === 'supabase'
                      ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                  }`}>
                    <Database size={24} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900 dark:text-white">Supabase 数据库存储</span>
                      {selectedMode === 'supabase' && (
                        <Check size={16} className="text-blue-500" />
                      )}
                    </div>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                      笔记和分类存储在 Supabase PostgreSQL 数据库
                    </p>
                    <div className="flex flex-wrap gap-2 mt-3">
                      <span className="text-xs px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded">
                        笔记 → Supabase
                      </span>
                      <span className="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded">
                        附件 → 本地文件
                      </span>
                    </div>
                  </div>
                </button>

                {/* 测试连接按钮 */}
                <div className="px-4 pb-4">
                  <button
                    onClick={() => handleTestConnection('supabase')}
                    disabled={isChecking && activeProvider === 'supabase'}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white text-sm font-medium rounded-lg transition-colors"
                  >
                    {isChecking && activeProvider === 'supabase' ? (
                      <RefreshCw size={16} className="animate-spin" />
                    ) : (
                      <Terminal size={16} />
                    )}
                    {isChecking && activeProvider === 'supabase' ? '测试连接中...' : '测试 Supabase 连接'}
                  </button>
                </div>
              </div>

              {/* Redis 选项 */}
              <div className={`rounded-xl border-2 transition-all duration-200 ${
                selectedMode === 'redis'
                  ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-900/20'
                  : 'border-gray-200 dark:border-gray-700'
              }`}>
                <button
                  onClick={() => handleModeChange('redis')}
                  className="w-full flex items-start gap-4 p-4 text-left"
                >
                  <div className={`p-3 rounded-lg ${
                    selectedMode === 'redis'
                      ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                  }`}>
                    <Server size={24} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900 dark:text-white">Upstash Redis 存储</span>
                      {selectedMode === 'redis' && (
                        <Check size={16} className="text-blue-500" />
                      )}
                    </div>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                      笔记和分类存储在 Upstash Redis 内存数据库
                    </p>
                    <div className="flex flex-wrap gap-2 mt-3">
                      <span className="text-xs px-2 py-1 bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 rounded">
                        笔记 → Redis
                      </span>
                      <span className="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded">
                        附件 → 本地文件
                      </span>
                    </div>
                  </div>
                </button>

                {/* 测试连接按钮 */}
                <div className="px-4 pb-4">
                  <button
                    onClick={() => handleTestConnection('redis')}
                    disabled={isChecking && activeProvider === 'redis'}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-orange-600 hover:bg-orange-700 disabled:bg-orange-400 text-white text-sm font-medium rounded-lg transition-colors"
                  >
                    {isChecking && activeProvider === 'redis' ? (
                      <RefreshCw size={16} className="animate-spin" />
                    ) : (
                      <Terminal size={16} />
                    )}
                    {isChecking && activeProvider === 'redis' ? '测试连接中...' : '测试 Redis 连接'}
                  </button>
                </div>
              </div>

              {/* MongoDB 选项 */}
              <div className={`rounded-xl border-2 transition-all duration-200 ${
                selectedMode === 'mongodb'
                  ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-900/20'
                  : 'border-gray-200 dark:border-gray-700'
              }`}>
                <button
                  onClick={() => handleModeChange('mongodb')}
                  className="w-full flex items-start gap-4 p-4 text-left"
                >
                  <div className={`p-3 rounded-lg ${
                    selectedMode === 'mongodb'
                      ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                  }`}>
                    <Leaf size={24} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900 dark:text-white">MongoDB 存储</span>
                      {selectedMode === 'mongodb' && (
                        <Check size={16} className="text-blue-500" />
                      )}
                    </div>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                      笔记和分类存储在 MongoDB 文档数据库
                    </p>
                    <div className="flex flex-wrap gap-2 mt-3">
                      <span className="text-xs px-2 py-1 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 rounded">
                        笔记 → MongoDB
                      </span>
                      <span className="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded">
                        附件 → 本地文件
                      </span>
                    </div>
                  </div>
                </button>

                {/* 测试连接按钮 */}
                <div className="px-4 pb-4">
                  <button
                    onClick={() => handleTestConnection('mongodb')}
                    disabled={isChecking && activeProvider === 'mongodb'}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white text-sm font-medium rounded-lg transition-colors"
                  >
                    {isChecking && activeProvider === 'mongodb' ? (
                      <RefreshCw size={16} className="animate-spin" />
                    ) : (
                      <Terminal size={16} />
                    )}
                    {isChecking && activeProvider === 'mongodb' ? '测试连接中...' : '测试 MongoDB 连接'}
                  </button>
                </div>
              </div>
            </div>

            {/* 连接状态 */}
            {connectionStatus !== null && !isChecking && (
              <div className={`flex items-start gap-2 p-3 rounded-lg ${
                connectionStatus
                  ? 'bg-green-50 dark:bg-green-900/20'
                  : 'bg-red-50 dark:bg-red-900/20'
              }`}>
                {connectionStatus ? (
                  <Check size={18} className="text-green-500 mt-0.5" />
                ) : (
                  <AlertCircle size={18} className="text-red-500 mt-0.5" />
                )}
                <div className={`text-sm ${
                  connectionStatus
                    ? 'text-green-700 dark:text-green-400'
                    : 'text-red-700 dark:text-red-400'
                }`}>
                  {connectionStatus
                    ? `${activeProvider === 'supabase' ? 'Supabase' : activeProvider === 'redis' ? 'Redis' : 'MongoDB'} 连接成功！`
                    : `无法连接到 ${activeProvider === 'supabase' ? 'Supabase' : activeProvider === 'redis' ? 'Redis' : 'MongoDB'}，请查看下方日志了解详情`}
                </div>
              </div>
            )}

            {/* 日志面板 */}
            {showLogs && (
              <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
                {/* 日志头部 */}
                <div className="flex items-center justify-between px-4 py-2 bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700">
                  <div className="flex items-center gap-2">
                    <Terminal size={16} className="text-gray-500 dark:text-gray-400" />
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      {activeProvider === 'supabase' ? 'Supabase' : activeProvider === 'redis' ? 'Redis' : 'MongoDB'} 连接日志
                    </span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">({logs.length} 条)</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={handleCopyLogs}
                      className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
                      title="复制日志"
                    >
                      {copied ? (
                        <Check size={14} className="text-green-500" />
                      ) : (
                        <Copy size={14} className="text-gray-500 dark:text-gray-400" />
                      )}
                    </button>
                    <button
                      onClick={handleClearLogs}
                      className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
                      title="清空日志"
                    >
                      <Trash2 size={14} className="text-gray-500 dark:text-gray-400" />
                    </button>
                  </div>
                </div>

                {/* 日志内容 */}
                <div
                  ref={logsContainerRef}
                  onScroll={handleLogsScroll}
                  className="max-h-64 overflow-y-auto p-2 space-y-1 bg-gray-900 font-mono text-xs"
                >
                  {logs.length === 0 ? (
                    <div className="text-gray-500 text-center py-4">暂无日志</div>
                  ) : (
                    logs.map((log, index) => (
                      <div key={index} className="flex gap-2">
                        <span className="text-gray-500 shrink-0">{formatTime(log.timestamp)}</span>
                        <span className={`px-1.5 py-0.5 rounded text-xs font-semibold shrink-0 ${getLogLevelBgColor(log.level)} ${getLogLevelColor(log.level)}`}>
                          {log.level.toUpperCase()}
                        </span>
                        <div className="flex-1 min-w-0">
                          <span className="text-gray-300">{log.message}</span>
                          {log.details && (
                            <div className="text-gray-500 mt-0.5 whitespace-pre-wrap break-all">
                              {log.details}
                            </div>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                  <div ref={logsEndRef} />
                </div>
              </div>
            )}

            {/* 重启提示 */}
            {showRestartHint && (
              <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-200 dark:border-amber-800">
                <div className="flex items-start gap-3">
                  <AlertCircle size={20} className="text-amber-600 dark:text-amber-400 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm text-amber-800 dark:text-amber-300">
                      存储模式已更改，需要刷新页面才能生效
                    </p>
                    <button
                      onClick={handleRefresh}
                      className="mt-3 flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium rounded-lg transition-colors"
                    >
                      <RefreshCw size={16} />
                      立即刷新
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* 当前配置信息 */}
            <div className="p-4 bg-gray-50 dark:bg-gray-900/50 rounded-xl">
              <h4 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
                当前配置
              </h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">存储模式</span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {selectedMode === 'local' ? '本地存储' : selectedMode === 'supabase' ? 'Supabase' : selectedMode === 'redis' ? 'Upstash Redis' : 'MongoDB'}
                  </span>
                </div>
                {selectedMode === 'supabase' && (
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Supabase 地址</span>
                    <span className="font-mono text-xs text-gray-500 dark:text-gray-400 truncate max-w-[200px]">
                      pjpvhsqqbzrwdvzmfztf.supabase.co
                    </span>
                  </div>
                )}
                {selectedMode === 'redis' && (
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Redis 地址</span>
                    <span className="font-mono text-xs text-gray-500 dark:text-gray-400 truncate max-w-[200px]">
                      vocal-spaniel-74996.upstash.io
                    </span>
                  </div>
                )}
                {selectedMode === 'mongodb' && (
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">MongoDB 用户</span>
                    <span className="font-mono text-xs text-gray-500 dark:text-gray-400 truncate max-w-[200px]">
                      caicaidarenya_db_user
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <style jsx global>{`
        @keyframes dialogFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes dialogFadeOut {
          from { opacity: 1; }
          to { opacity: 0; }
        }
        @keyframes dialogScaleIn {
          from {
            opacity: 0;
            transform: scale(0.95) translateY(10px);
          }
          to {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }
        @keyframes dialogScaleOut {
          from {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
          to {
            opacity: 0;
            transform: scale(0.95) translateY(10px);
          }
        }
      `}</style>
    </>
  );
}
