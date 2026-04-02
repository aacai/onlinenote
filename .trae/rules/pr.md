优先用 .trae/skills 技能
UI/动画优先，IO 等动画完成后再执行
禁在 effect 内同步 setState，用 useSyncExternalStore 替代 useState+useEffect 检测挂载
