# Lexical 编辑器光标位置保持指南

## 问题描述

在使用 Lexical 编辑器时，如果采用受控组件模式（通过 props 传入 content 并通过 onChange 回调更新），会出现以下问题：

1. **回车键**：光标跳到文档开头
2. **退格键**：删除正常但光标跳到开头
3. **输入文字**：光标位置异常

## 根本原因

当编辑器内容变化时，`onChange` 回调更新父组件 state，父组件通过 props 传回新的 content，触发 `ContentUpdatePlugin` 重新设置编辑器内容，导致光标位置丢失。

```
用户输入 -> onChange -> 父组件setState -> content prop变化 -> ContentUpdatePlugin重置内容 -> 光标丢失
```

## 解决方案

### 正确实现：区分内部更新和外部更新

```typescript
function ContentUpdatePlugin({ content }: { content: string }) {
  const [editor] = useLexicalComposerContext();
  const prevContentRef = useRef(content);
  const isExternalUpdateRef = useRef(false);

  useEffect(() => {
    // 订阅编辑器内部变化
    const unregisterUpdateListener = editor.registerUpdateListener(({ editorState }) => {
      // 只有非外部更新时才同步 prevContentRef
      if (!isExternalUpdateRef.current) {
        const text = editorStateToText(editorState);
        prevContentRef.current = text;
      }
      isExternalUpdateRef.current = false;
    });

    return () => {
      unregisterUpdateListener();
    };
  }, [editor]);

  useEffect(() => {
    // 只有当 content 与上次记录的内容不同时才更新
    if (content !== prevContentRef.current) {
      prevContentRef.current = content;
      isExternalUpdateRef.current = true; // 标记为外部更新
      editor.update(() => {
        textToEditorState(content)(editor);
      });
    }
  }, [editor, content]);

  return null;
}
```

### 关键要点

1. **使用 `registerUpdateListener`**：监听编辑器内部状态变化，同步更新 `prevContentRef`
2. **标记外部更新**：通过 `isExternalUpdateRef` 区分是用户输入还是外部 prop 变化
3. **比较内容差异**：只在 content prop 真正变化时才重置编辑器内容

## 错误实现（不要这样做）

```typescript
// ❌ 错误：简单比较会导致循环更新
useEffect(() => {
  if (content !== prevContentRef.current) {
    prevContentRef.current = content;
    editor.update(() => {
      textToEditorState(content)(editor);
    });
  }
}, [editor, content]);
```

```typescript
// ❌ 错误：使用标志位但不监听内部变化
const isUpdatingRef = useRef(false);

useEffect(() => {
  if (isUpdatingRef.current) {
    isUpdatingRef.current = false;
    return;
  }
  // 更新编辑器...
  isUpdatingRef.current = true;
}, [editor, content]);
```

## 相关文件

- `src/components/LexicalEditor.tsx` - Lexical 编辑器实现
- `src/components/NoteEditor.tsx` - 笔记编辑器父组件

## 参考

- [Lexical Documentation](https://lexical.dev/)
- [Lexical GitHub Issues - Cursor position](https://github.com/facebook/lexical/issues)
