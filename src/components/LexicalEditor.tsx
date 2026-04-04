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
  ElementNode,
  PASTE_COMMAND,
  UNDO_COMMAND,
  REDO_COMMAND,
  FORMAT_TEXT_COMMAND,
  LexicalNode,
  LexicalEditor as LexicalEditorType,
} from 'lexical';
import { $createListNode, $createListItemNode, $isListNode } from '@lexical/list';
import { TOGGLE_LINK_COMMAND } from '@lexical/link';
import { $getNearestNodeOfType, mergeRegister } from '@lexical/utils';
import {
  $createHeadingNode,
  $createQuoteNode,
  $isHeadingNode,
  $isQuoteNode,
  HeadingTagType,
} from '@lexical/rich-text';
import {
  $createCodeNode,
  $isCodeNode,
} from '@lexical/code';
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Code,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Quote,
  Code2,
  Link,
  Minus,
  Undo,
  Redo,
} from 'lucide-react';
import { $convertFromMarkdownString } from '@lexical/markdown';
import { TRANSFORMERS } from '@lexical/markdown';
import { LinkNode, AutoLinkNode } from '@lexical/link';
import { ListNode, ListItemNode } from '@lexical/list';
import { HeadingNode, QuoteNode } from '@lexical/rich-text';
import { CodeNode, CodeHighlightNode } from '@lexical/code';
import { useTheme } from '@/contexts/ThemeContext';

interface LexicalEditorProps {
  content: string;
  onChange: (content: string) => void;
  editable?: boolean;
  saveStatus?: 'saved' | 'saving' | 'unsaved';
  lastSavedAt?: Date | null;
}

// 将纯文本转换为编辑器状态
const textToEditorState = (text: string) => {
  return () => {
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
    const unregisterUpdateListener = editor.registerUpdateListener(({ editorState }) => {
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
        textToEditorState(content)();
      });
    }
  }, [editor, content]);

  return null;
}

// 获取最近的块级祖先节点
function $getNearestBlockElementAncestorOrThrow(node: LexicalNode): ElementNode {
  let parent: LexicalNode | null = node;
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
            $convertFromMarkdownString(text, TRANSFORMERS);
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

function ToolbarDivider() {
  return <div className="w-px h-5 bg-gray-200 dark:bg-gray-700 mx-1" />;
}

function ToolbarButton({ 
  onClick, 
  isActive, 
  disabled, 
  children, 
  title 
}: { 
  onClick: () => void; 
  isActive?: boolean; 
  disabled?: boolean;
  children: React.ReactNode; 
  title: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`p-1.5 rounded transition-colors ${
        isActive 
          ? 'bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400' 
          : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400'
      } disabled:opacity-50 disabled:cursor-not-allowed`}
    >
      {children}
    </button>
  );
}

function ToolbarPlugin() {
  const [editor] = useLexicalComposerContext();
  const [isBold, setIsBold] = React.useState(false);
  const [isItalic, setIsItalic] = React.useState(false);
  const [isUnderline, setIsUnderline] = React.useState(false);
  const [isStrikethrough, setIsStrikethrough] = React.useState(false);
  const [isCode, setIsCode] = React.useState(false);
  const [blockType, setBlockType] = React.useState<string>('paragraph');

  const updateToolbar = React.useCallback(() => {
    const selection = $getSelection();
    if (!$isRangeSelection(selection)) {
      return;
    }

    setIsBold(selection.hasFormat('bold'));
    setIsItalic(selection.hasFormat('italic'));
    setIsUnderline(selection.hasFormat('underline'));
    setIsStrikethrough(selection.hasFormat('strikethrough'));
    setIsCode(selection.hasFormat('code'));

    const anchorNode = selection.anchor.getNode();
    let element = null;
    
    try {
      element = anchorNode.getTopLevelElement();
    } catch {
      // Ignore if we can't get top level element
    }
    
    if (!element) {
      setBlockType('paragraph');
      return;
    }
    
    if ($isHeadingNode(element)) {
      setBlockType(element.getTag());
    } else if ($isListNode(element)) {
      setBlockType(element.getListType());
    } else if ($isQuoteNode(element)) {
      setBlockType('quote');
    } else if ($isCodeNode(element)) {
      setBlockType('code');
    } else {
      setBlockType('paragraph');
    }
  }, []);

  React.useEffect(() => {
    return mergeRegister(
      editor.registerUpdateListener(({ editorState }) => {
        editorState.read(() => {
          updateToolbar();
        });
      })
    );
  }, [editor, updateToolbar]);

  const formatHeading = (headingType: HeadingTagType) => {
    editor.update(() => {
      const selection = $getSelection();
      if (!$isRangeSelection(selection)) return;

      $getNearestNodeOfType(selection.anchor.getNode(), HeadingNode)?.remove();

      const headingNode = $createHeadingNode(headingType);
      selection.insertNodes([headingNode]);
    });
  };

  const formatQuote = () => {
    editor.update(() => {
      const selection = $getSelection();
      if (!$isRangeSelection(selection)) return;

      const quote = $createQuoteNode();
      selection.insertNodes([quote]);
    });
  };

  const formatCode = () => {
    editor.update(() => {
      const selection = $getSelection();
      if (!$isRangeSelection(selection)) return;

      const code = $createCodeNode();
      selection.insertNodes([code]);
    });
  };

  const formatList = (listType: 'bullet' | 'number' | 'check') => {
    editor.update(() => {
      const selection = $getSelection();
      if (!$isRangeSelection(selection)) return;

      const list = $createListNode(listType);
      const listItem = $createListItemNode();
      list.append(listItem);
      selection.insertNodes([list]);
    });
  };

  const insertLink = () => {
    const url = prompt('输入链接地址:', 'https://');
    if (url) {
      editor.dispatchCommand(TOGGLE_LINK_COMMAND, { url, target: '_blank' });
    }
  };

  const insertDivider = () => {
    editor.update(() => {
      const selection = $getSelection();
      if (!$isRangeSelection(selection)) return;

      const divider = $createParagraphNode();
      divider.append($createTextNode('---'));
      selection.insertNodes([divider, $createParagraphNode()]);
    });
  };

  return (
    <div className="flex items-center gap-0.5 p-1.5 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 rounded-t-lg flex-wrap">
      <ToolbarButton onClick={() => editor.dispatchCommand(UNDO_COMMAND, undefined)} title="撤销 (Ctrl+Z)">
        <Undo size={16} />
      </ToolbarButton>
      <ToolbarButton onClick={() => editor.dispatchCommand(REDO_COMMAND, undefined)} title="重做 (Ctrl+Y)">
        <Redo size={16} />
      </ToolbarButton>
      
      <ToolbarDivider />
      
      <ToolbarButton 
        onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'bold')} 
        isActive={isBold}
        title="粗体 (Ctrl+B)"
      >
        <Bold size={16} />
      </ToolbarButton>
      <ToolbarButton 
        onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'italic')} 
        isActive={isItalic}
        title="斜体 (Ctrl+I)"
      >
        <Italic size={16} />
      </ToolbarButton>
      <ToolbarButton 
        onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'underline')} 
        isActive={isUnderline}
        title="下划线 (Ctrl+U)"
      >
        <Underline size={16} />
      </ToolbarButton>
      <ToolbarButton 
        onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'strikethrough')} 
        isActive={isStrikethrough}
        title="删除线"
      >
        <Strikethrough size={16} />
      </ToolbarButton>
      <ToolbarButton 
        onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'code')} 
        isActive={isCode}
        title="行内代码"
      >
        <Code size={16} />
      </ToolbarButton>

      <ToolbarDivider />

      <ToolbarButton 
        onClick={() => formatHeading('h1')} 
        isActive={blockType === 'h1'}
        title="标题 1"
      >
        <Heading1 size={16} />
      </ToolbarButton>
      <ToolbarButton 
        onClick={() => formatHeading('h2')} 
        isActive={blockType === 'h2'}
        title="标题 2"
      >
        <Heading2 size={16} />
      </ToolbarButton>
      <ToolbarButton 
        onClick={() => formatHeading('h3')} 
        isActive={blockType === 'h3'}
        title="标题 3"
      >
        <Heading3 size={16} />
      </ToolbarButton>

      <ToolbarDivider />

      <ToolbarButton 
        onClick={() => formatList('bullet')} 
        isActive={blockType === 'bullet'}
        title="无序列表"
      >
        <List size={16} />
      </ToolbarButton>
      <ToolbarButton 
        onClick={() => formatList('number')} 
        isActive={blockType === 'number'}
        title="有序列表"
      >
        <ListOrdered size={16} />
      </ToolbarButton>
      <ToolbarButton 
        onClick={formatQuote} 
        isActive={blockType === 'quote'}
        title="引用"
      >
        <Quote size={16} />
      </ToolbarButton>
      <ToolbarButton 
        onClick={formatCode} 
        isActive={blockType === 'code'}
        title="代码块"
      >
        <Code2 size={16} />
      </ToolbarButton>

      <ToolbarDivider />

      <ToolbarButton onClick={insertLink} title="插入链接">
        <Link size={16} />
      </ToolbarButton>
      <ToolbarButton onClick={insertDivider} title="分割线">
        <Minus size={16} />
      </ToolbarButton>
    </div>
  );
}

function StatusBarPlugin({ 
  saveStatus = 'saved', 
  lastSavedAt 
}: { 
  saveStatus?: 'saved' | 'saving' | 'unsaved';
  lastSavedAt?: Date | null;
}) {
  const [editor] = useLexicalComposerContext();
  const [stats, setStats] = React.useState({ chars: 0, words: 0, lines: 0 });
  const [cursorPos, setCursorPos] = React.useState({ line: 1, col: 1 });

  const updateStats = React.useCallback(() => {
    const text = editorStateToText(editor.getEditorState());
    
    const chars = text.length;
    const words = text.trim() ? text.trim().split(/\s+/).length : 0;
    const lines = text.split('\n').length;
    
    setStats({ chars, words, lines });

    const selection = $getSelection();
    if ($isRangeSelection(selection)) {
      const anchor = selection.anchor;
      const root = $getRoot();
      const allText = root.getTextContent();
      const allLines = allText.split('\n');
      
      let charCount = 0;
      let lineNum = 1;
      
      for (let i = 0; i < allLines.length; i++) {
        const lineLength = allLines[i].length;
        if (charCount + lineLength >= anchor.offset + (i > 0 ? charCount : 0)) {
          lineNum = i + 1;
          break;
        }
        charCount += lineLength + 1;
      }
      
      const node = anchor.getNode();
      const nodeText = node.getTextContent();
      const col = anchor.offset + 1;
      
      setCursorPos({ line: lineNum, col });
    }
  }, [editor]);

  React.useEffect(() => {
    return editor.registerUpdateListener(() => {
      editor.getEditorState().read(() => {
        updateStats();
      });
    });
  }, [editor, updateStats]);

  React.useEffect(() => {
    editor.getEditorState().read(() => {
      updateStats();
    });
  }, [editor, updateStats]);

  const formatTime = (date: Date | null) => {
    if (!date) return '';
    return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  };

  const getStatusText = () => {
    switch (saveStatus) {
      case 'saving':
        return '保存中...';
      case 'unsaved':
        return '未保存';
      case 'saved':
      default:
        return lastSavedAt ? `已保存 · ${formatTime(lastSavedAt)}` : '已保存';
    }
  };

  const getStatusColor = () => {
    switch (saveStatus) {
      case 'saving':
        return 'text-yellow-500';
      case 'unsaved':
        return 'text-orange-500';
      case 'saved':
      default:
        return 'text-green-500';
    }
  };

  return (
    <div className="flex items-center justify-between px-3 py-1 text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
      <div className="flex items-center gap-3">
        <span>字数: {stats.words}</span>
        <span className="text-gray-300 dark:text-gray-600">|</span>
        <span>字符: {stats.chars}</span>
        <span className="text-gray-300 dark:text-gray-600">|</span>
        <span>行 {cursorPos.line}, 列 {cursorPos.col}</span>
      </div>
      <div className={`flex items-center gap-1 ${getStatusColor()}`}>
        {saveStatus === 'saving' && (
          <div className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />
        )}
        <span>{getStatusText()}</span>
      </div>
    </div>
  );
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
          const beforeNodes: LexicalNode[] = [];
          const afterNodes: LexicalNode[] = [];
          let foundAnchor = false;

          for (const child of children) {
            if (!foundAnchor) {
              if (child.getKey() === anchorKey) {
                foundAnchor = true;
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
const getTheme = (_isDark: boolean) => ({
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
  saveStatus = 'saved',
  lastSavedAt = null,
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
      CodeNode,
      CodeHighlightNode,
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
        <ToolbarPlugin />
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
              <div className="absolute top-16 left-4 text-gray-400 pointer-events-none select-none">
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
        <StatusBarPlugin saveStatus={saveStatus} lastSavedAt={lastSavedAt} />
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
