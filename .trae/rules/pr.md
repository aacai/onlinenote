我在.trae/skills安装了很多技能，在执行时候看看有没有合适的技能可以运用。
UI，动画优先，IO等操作先等待动画完成后再执行
把 useState(false) + useEffect(() => setMounted(true), []) 模式替换为 useSyncExternalStore，React 19 推荐的检测挂载状态的方式