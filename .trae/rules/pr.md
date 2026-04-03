优先用 .trae/skills 技能
UI/动画优先，IO 等动画完成后再执行
禁在 effect 内同步 setState，用 useSyncExternalStore 替代 useState+useEffect 检测挂载
禁止用put/delete方法，只能用get/post方法
不要在沙箱运行命令
虽然用到了tarui,但是这个必须也可以不依赖tarui独立运行
请遵循静态导出的最佳实践，确保所有路由都支持静态导出