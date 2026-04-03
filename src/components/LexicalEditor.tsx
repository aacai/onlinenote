'use client';

import React, { useCallback, useEffect, useRef, useSyncExternalStore } from 'react';
import { LexicalComposer } from '@lexical/react/LexicalComposer';
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin';
import { ContentEditable } from '@lexical/react/LexicalContentEditable';
import { HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin';
import { OnChangePlugin } from '@lexical/react/LexicalOnChangePlugin';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary';
import { AutoFocusPlugin } from '@lexical/react/LexicalAutoFocusPlugin';
import { LinkPlugin } from '@lexical/react/LexicalLinkPlugin';
import { ListPlugin } from '@lexical/react/LexicalListPlugin';
import { MarkdownShortcutPlugin } from '@lexical/react/LexicalMarkdownShortcutPlugin';
import {
  $createParagraphNode,
  $createTextNode,
  $getRoot,
  EditorState,
  $getSelection,
  $isRangeSelection,
  $isTextNode,
  COMMAND_PRIORITY_LOW,
  KEY_ENTER_COMMAND,
  INSERT_PARAGRAPH_COMMAND,
  $isRootOrShadowRoot,
  $isElementNode,
  $createRangeSelection,
  $setSelection,
  ParagraphNode,
  ElementNode,
  PASTE_COMMAND,
} from 'lexical';
import { $convertFromMarkdownString, $convertToMarkdownString } from '@lexical/markdown';
import { TRANSFORMERS } from '@lexical/markdown';
import { LinkNode, AutoLinkNode } from '@lexical/link';
import { ListNode, ListItemNode } from '@lexical/list';
import { HeadingNode, QuoteNode } from '@lexical/rich-text';
import { useTheme } from '@/contexts/ThemeContext';

interface LexicalEditorProps {
  content: string;
  onChange: (content: string) => void;
  editable?: boolean;
}

// 将纯文本转换为编辑器状态
const textToEditorState = (text: string) => {
  return (editor: Parameters<Parameters<typeof useLexicalComposerContext>[0]['update']>[0] extends infer R ? R : never) => {
    const root = $getRoot();
    root.clear();

    if (!text || text.trim() === '') {
      const paragraph = $createParagraphNode();
      root.append(paragraph);
      return;
    }

    const lines = text.split('\n');
    for (const line of lines) {
      const paragraph = $createParagraphNode();
      if (line) {
        paragraph.append($createTextNode(line));
      }
      root.append(paragraph);
    }
  };
};

// 将编辑器状态转换为纯文本
const editorStateToText = (editorState: EditorState): string => {
  let text = '';
  editorState.read(() => {
    const root = $getRoot();
    const children = root.getChildren();
    const lines: string[] = [];

    for (const child of children) {
      lines.push(child.getTextContent());
    }
    text = lines.join('\n');
  });
  return text;
};

// 内容更新插件 - 监听外部 content 变化
function ContentUpdatePlugin({ content }: { content: string }) {
  const [editor] = useLexicalComposerContext();
  const prevContentRef = useRef(content);
  const isExternalUpdateRef = useRef(false);

  useEffect(() => {
    // 订阅编辑器更新，标记是否为外部更新
    const unregisterUpdateListener = editor.registerUpdateListener(({ editorState, prevEditorState }) => {
      // 如果编辑器状态变化，且不是由外部 content 变化引起的，则更新 prevContentRef
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
    // 这样可以避免编辑器自身变化导致的循环更新
    if (content !== prevContentRef.current) {
      prevContentRef.current = content;
      isExternalUpdateRef.current = true;
      editor.update(() => {
        textToEditorState(content)(editor);
      });
    }
  }, [editor, content]);

  return null;
}

// 获取最近的块级祖先节点
function $getNearestBlockElementAncestorOrThrow(node: any): ElementNode {
  let parent = node;
  while (parent !== null && !$isRootOrShadowRoot(parent)) {
    if ($isElementNode(parent)) {
      return parent;
    }
    parent = parent.getParent();
  }
  throw new Error('Expected node to have a block element ancestor');
}

// Markdown 粘贴处理插件
function MarkdownPastePlugin() {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    const removeListener = editor.registerCommand(
      PASTE_COMMAND,
      (event: ClipboardEvent) => {
        const clipboardData = event.clipboardData;
        if (!clipboardData) return false;

        // 优先尝试获取 HTML 格式
        const html = clipboardData.getData('text/html');
        const text = clipboardData.getData('text/plain');

        // 如果文本看起来像 Markdown（包含 # * - ` 等标记），尝试作为 Markdown 解析
        const markdownPatterns = [
          /^#{1,6}\s/m,           // 标题
          /^\s*[-*+]\s/m,        // 列表
          /^\s*\d+\.\s/m,        // 有序列表
          /\*\*.*?\*\*/,         // 粗体
          /\*.*?\*/,             // 斜体
          /`{1,3}[^`]+`{1,3}/,   // 行内代码/代码块
          /^\s*```/m,            // 代码块
          /^\[.*?\]\(.*?\)/m,    // 链接
          /^>\s/m,               // 引用
        ];

        const looksLikeMarkdown = markdownPatterns.some(pattern => pattern.test(text));

        if (looksLikeMarkdown && !html) {
          event.preventDefault();
          editor.update(() => {
            const selection = $getSelection();
            if ($isRangeSelection(selection)) {
              $convertFromMarkdownString(text, TRANSFORMERS, selection);
            } else {
              $convertFromMarkdownString(text, TRANSFORMERS);
            }
          });
          return true;
        }

        return false;
      },
      COMMAND_PRIORITY_LOW
    );

    return () => {
      removeListener();
    };
  }, [editor]);

  return null;
}

// 回车键处理插件 - 修复换行问题
function EnterKeyPlugin() {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    const removeListener = editor.registerCommand(
      KEY_ENTER_COMMAND,
      (event) => {
        const selection = $getSelection();
        if (!$isRangeSelection(selection)) {
          return false;
        }

        event?.preventDefault();

        editor.update(() => {
          const selection = $getSelection();
          if (!$isRangeSelection(selection)) {
            return;
          }

          const anchor = selection.anchor;
          const focus = selection.focus;
          const anchorNode = anchor.getNode();
          const focusNode = focus.getNode();

          // 获取当前块级元素（段落、标题等）
          let currentBlock: ElementNode | null = null;
          try {
            currentBlock = $getNearestBlockElementAncestorOrThrow(anchorNode);
          } catch {
            // 如果找不到块级祖先，使用默认行为
            editor.dispatchCommand(INSERT_PARAGRAPH_COMMAND, undefined);
            return;
          }

          // 如果当前在列表项中，让 ListPlugin 处理
          if (currentBlock.getType() === 'listitem') {
            editor.dispatchCommand(INSERT_PARAGRAPH_COMMAND, undefined);
            return;
          }

          // 处理选区跨越多个节点的情况
          if (anchorNode !== focusNode || anchor.offset !== focus.offset) {
            // 删除选中的内容
            selection.extract();
            // 重新获取选择
            const newSelection = $getSelection();
            if (!$isRangeSelection(newSelection)) {
              return;
            }
          }

          // 获取当前块的内容
          const children = currentBlock.getChildren();
          const anchorKey = anchor.getNode().getKey();
          const anchorOffset = anchor.offset;

          // 找到光标所在的文本节点在块中的位置
          let beforeNodes: any[] = [];
          let afterNodes: any[] = [];
          let foundAnchor = false;
          let anchorTextIndex = 0;

          for (const child of children) {
            if (!foundAnchor) {
              if (child.getKey() === anchorKey) {
                foundAnchor = true;
                anchorTextIndex = anchorOffset;
                // 分割这个文本节点
                if ($isTextNode(child)) {
                  const text = child.getTextContent();
                  const beforeText = text.slice(0, anchorOffset);
                  const afterText = text.slice(anchorOffset);
                  
                  if (beforeText) {
                    beforeNodes.push($createTextNode(beforeText));
                  }
                  if (afterText) {
                    afterNodes.push($createTextNode(afterText));
                  }
                } else {
                  beforeNodes.push(child);
                }
              } else {
                beforeNodes.push(child);
              }
            } else {
              afterNodes.push(child);
            }
          }

          // 更新当前块
          currentBlock.clear();
          for (const node of beforeNodes) {
            currentBlock.append(node);
          }

          // 创建新段落
          const newParagraph = $createParagraphNode();
          for (const node of afterNodes) {
            newParagraph.append(node);
          }

          // 在当前块后插入新段落
          currentBlock.insertAfter(newParagraph);

          // 将光标移动到新段落开头
          const newSelection = $createRangeSelection();
          if (newParagraph.getChildrenSize() > 0) {
            const firstChild = newParagraph.getFirstChild();
            if (firstChild && $isTextNode(firstChild)) {
              // 光标在第一个文本节点开头
              newSelection.anchor.set(firstChild.getKey(), 0, 'text');
              newSelection.focus.set(firstChild.getKey(), 0, 'text');
            } else {
              // 光标在元素节点开头
              newSelection.anchor.set(newParagraph.getKey(), 0, 'element');
              newSelection.focus.set(newParagraph.getKey(), 0, 'element');
            }
          } else {
            // 空段落，光标在段落开头
            newSelection.anchor.set(newParagraph.getKey(), 0, 'element');
            newSelection.focus.set(newParagraph.getKey(), 0, 'element');
          }
          $setSelection(newSelection);
        });

        return true;
      },
      COMMAND_PRIORITY_LOW
    );

    return () => {
      removeListener();
    };
  }, [editor]);

  return null;
}

// 主题配置
const getTheme = (isDark: boolean) => ({
  ltr: 'ltr',
  rtl: 'rtl',
  placeholder: 'editor-placeholder',
  paragraph: 'editor-paragraph',
  quote: 'editor-quote',
  heading: {
    h1: 'editor-heading-h1',
    h2: 'editor-heading-h2',
    h3: 'editor-heading-h3',
    h4: 'editor-heading-h4',
    h5: 'editor-heading-h5',
    h6: 'editor-heading-h6',
  },
  list: {
    nested: {
      listitem: 'editor-nested-listitem',
    },
    ol: 'editor-list-ol',
    ul: 'editor-list-ul',
    listitem: 'editor-listitem',
  },
  image: 'editor-image',
  link: 'editor-link',
  text: {
    bold: 'editor-text-bold',
    italic: 'editor-text-italic',
    overflowed: 'editor-text-overflowed',
    hashtag: 'editor-text-hashtag',
    underline: 'editor-text-underline',
    strikethrough: 'editor-text-strikethrough',
    underlineStrikethrough: 'editor-text-underlineStrikethrough',
    code: 'editor-text-code',
  },
  code: 'editor-code',
  codeHighlight: {
    atrule: 'editor-tokenAttr',
    attr: 'editor-tokenAttr',
    boolean: 'editor-tokenProperty',
    builtin: 'editor-tokenSelector',
    cdata: 'editor-tokenComment',
    char: 'editor-tokenSelector',
    class: 'editor-tokenFunction',
    'class-name': 'editor-tokenFunction',
    comment: 'editor-tokenComment',
    constant: 'editor-tokenProperty',
    deleted: 'editor-tokenProperty',
    doctype: 'editor-tokenComment',
    entity: 'editor-tokenOperator',
    function: 'editor-tokenFunction',
    important: 'editor-tokenVariable',
    inserted: 'editor-tokenSelector',
    keyword: 'editor-tokenAttr',
    namespace: 'editor-tokenVariable',
    number: 'editor-tokenProperty',
    operator: 'editor-tokenOperator',
    prolog: 'editor-tokenComment',
    property: 'editor-tokenProperty',
    punctuation: 'editor-tokenPunctuation',
    regex: 'editor-tokenVariable',
    selector: 'editor-tokenSelector',
    string: 'editor-tokenSelector',
    symbol: 'editor-tokenProperty',
    tag: 'editor-tokenProperty',
    url: 'editor-tokenOperator',
    variable: 'editor-tokenVariable',
  },
});

export default function LexicalEditor({
  content,
  onChange,
  editable = true,
}: LexicalEditorProps) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const prevContentRef = useRef(content);

  const isMounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );

  const handleChange = useCallback((editorState: EditorState) => {
    const text = editorStateToText(editorState);
    if (text !== prevContentRef.current) {
      prevContentRef.current = text;
      onChange(text);
    }
  }, [onChange]);

  const initialConfig = {
    namespace: 'NoteEditor',
    theme: getTheme(isDark),
    onError: (error: Error) => {
      console.error('Lexical Error:', error);
    },
    nodes: [
      HeadingNode,
      ListNode,
      ListItemNode,
      QuoteNode,
      LinkNode,
      AutoLinkNode,
    ],
    editorState: textToEditorState(content),
    editable,
  };

  if (!isMounted) {
    return (
      <div className="h-full w-full flex items-center justify-center bg-white dark:bg-gray-900">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
      </div>
    );
  }

  return (
    <LexicalComposer initialConfig={initialConfig}>
      <div className="h-full flex flex-col relative">
        <div className="flex-1 overflow-y-auto">
          <RichTextPlugin
            contentEditable={
              <ContentEditable
                className={`h-full min-h-full p-4 outline-none ${
                  isDark ? 'text-gray-100' : 'text-gray-900'
                }`}
              />
            }
            placeholder={
              <div className="absolute top-4 left-4 text-gray-400 pointer-events-none select-none">
                开始输入...
              </div>
            }
            ErrorBoundary={LexicalErrorBoundary}
          />
        </div>
        <OnChangePlugin onChange={handleChange} />
        <HistoryPlugin />
        <ListPlugin />
        <LinkPlugin />
        <AutoFocusPlugin />
        <ContentUpdatePlugin content={content} />
        <EnterKeyPlugin />
        <MarkdownShortcutPlugin transformers={TRANSFORMERS} />
        <MarkdownPastePlugin />
      </div>
      <style jsx global>{`
        .editor-paragraph {
          margin: 0 0 4px 0;
          line-height: 1.6;
          min-height: 1.6em;
        }
        .editor-paragraph:last-child {
          margin-bottom: 0;
        }
        .editor-heading-h1 {
          font-size: 1.5rem;
          font-weight: bold;
          margin: 8px 0 4px 0;
        }
        .editor-heading-h2 {
          font-size: 1.25rem;
          font-weight: bold;
          margin: 8px 0 4px 0;
        }
        .editor-heading-h3 {
          font-size: 1.125rem;
          font-weight: bold;
          margin: 8px 0 4px 0;
        }
        .editor-list-ul {
          list-style-type: disc;
          padding-left: 1.5rem;
          margin: 4px 0;
        }
        .editor-list-ol {
          list-style-type: decimal;
          padding-left: 1.5rem;
          margin: 4px 0;
        }
        .editor-listitem {
          margin: 0 0 2px 0;
        }
        .editor-quote {
          border-left: 3px solid ${isDark ? '#4b5563' : '#d1d5db'};
          padding-left: 1rem;
          margin: 4px 0;
          color: ${isDark ? '#9ca3af' : '#6b7280'};
        }
        .editor-link {
          color: #3b82f6;
          text-decoration: underline;
        }
        .editor-text-bold {
          font-weight: bold;
        }
        .editor-text-italic {
          font-style: italic;
        }
        .editor-text-underline {
          text-decoration: underline;
        }
        .editor-text-strikethrough {
          text-decoration: line-through;
        }
        .editor-text-code {
          background-color: ${isDark ? '#374151' : '#f3f4f6'};
          padding: 2px 4px;
          border-radius: 4px;
          font-family: monospace;
          font-size: 0.875rem;
        }
        .editor-code {
          background-color: ${isDark ? '#1f2937' : '#f9fafb'};
          padding: 1rem;
          border-radius: 8px;
          font-family: monospace;
          font-size: 0.875rem;
          overflow-x: auto;
          margin: 4px 0;
        }
      `}</style>
    </LexicalComposer>
  );
}
