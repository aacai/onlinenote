'use client';

import React, { useSyncExternalStore, useCallback, useEffect } from 'react';
import { BlockNoteEditor as Editor, filterSuggestionItems } from '@blocknote/core';
import { BlockNoteView } from '@blocknote/mantine';
import {
  DefaultReactSuggestionItem,
  getDefaultReactSlashMenuItems,
  SuggestionMenuController,
  useCreateBlockNote,
} from '@blocknote/react';
import '@blocknote/mantine/style.css';
import { useTheme } from '@/contexts/ThemeContext';

interface BlockNoteEditorProps {
  content: string;
  onChange: (content: string) => void;
  editable?: boolean;
}

// 将 Markdown 转换为 BlockNote 的初始内容
const parseMarkdownToBlocks = (markdown: string) => {
  if (!markdown || markdown.trim() === '') {
    return [
      {
        type: 'paragraph' as const,
        content: '',
      },
    ];
  }

  const lines = markdown.split('\n');
  const blocks: Array<{ type: string; content?: string; props?: Record<string, unknown> }> = [];

  for (const line of lines) {
    const trimmedLine = line.trim();

    if (trimmedLine.startsWith('# ')) {
      blocks.push({
        type: 'heading',
        content: trimmedLine.slice(2),
        props: { level: 1 },
      });
    } else if (trimmedLine.startsWith('## ')) {
      blocks.push({
        type: 'heading',
        content: trimmedLine.slice(3),
        props: { level: 2 },
      });
    } else if (trimmedLine.startsWith('### ')) {
      blocks.push({
        type: 'heading',
        content: trimmedLine.slice(4),
        props: { level: 3 },
      });
    } else if (trimmedLine.startsWith('- ') || trimmedLine.startsWith('* ')) {
      blocks.push({
        type: 'bulletListItem',
        content: trimmedLine.slice(2),
      });
    } else if (/^\d+\.\s/.test(trimmedLine)) {
      blocks.push({
        type: 'numberedListItem',
        content: trimmedLine.replace(/^\d+\.\s/, ''),
      });
    } else if (trimmedLine.startsWith('> ')) {
      blocks.push({
        type: 'quote',
        content: trimmedLine.slice(2),
      });
    } else if (trimmedLine.startsWith('```')) {
      // 代码块开始
      continue;
    } else if (trimmedLine.startsWith('![') && trimmedLine.includes('](')) {
      // 图片
      const match = trimmedLine.match(/!\[(.*?)\]\((.*?)\)/);
      if (match) {
        blocks.push({
          type: 'image',
          props: {
            url: match[2],
            caption: match[1],
          },
        });
      }
    } else {
      blocks.push({
        type: 'paragraph',
        content: line,
      });
    }
  }

  return blocks.length > 0 ? blocks : [{ type: 'paragraph', content: '' }];
};

const extractText = (content: unknown): string => {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .map((item: unknown) => {
        if (typeof item === 'string') return item;
        if (item && typeof item === 'object' && 'text' in item) return (item as { text: string }).text;
        return '';
      })
      .join('');
  }
  return '';
};

// 将 BlockNote 内容转换为 Markdown
const blocksToMarkdown = (blocks: Array<{ type: string; content?: unknown; props?: Record<string, unknown> }>): string => {
  return blocks
    .map((block) => {
      const text = extractText(block.content);
      switch (block.type) {
        case 'heading': {
          const level = (block.props?.level as number) || 1;
          return `${'#'.repeat(level)} ${text}`;
        }
        case 'bulletListItem':
          return `- ${text}`;
        case 'numberedListItem':
          return `1. ${text}`;
        case 'quote':
          return `> ${text}`;
        case 'image': {
          const url = (block.props?.url as string) || '';
          const caption = (block.props?.caption as string) || '';
          return `![${caption}](${url})`;
        }
        case 'codeBlock':
          return `\`\`\`\n${text}\n\`\`\``;
        case 'paragraph':
        default:
          return text;
      }
    })
    .join('\n');
};

// 自定义斜杠菜单项
const getCustomSlashMenuItems = (
  editor: Editor
): DefaultReactSuggestionItem[] => [
  ...getDefaultReactSlashMenuItems(editor),
];

export default function BlockNoteEditor({
  content,
  onChange,
  editable = true,
}: BlockNoteEditorProps) {
  const { theme } = useTheme();

  const isMounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );

  const editor = useCreateBlockNote({
    initialContent: parseMarkdownToBlocks(content) as never[],
  });

  // 监听内容变化
  const handleChange = useCallback(() => {
    if (editor) {
      const blocks = editor.document;
      const markdown = blocksToMarkdown(blocks as never[]);
      onChange(markdown);
    }
  }, [editor, onChange]);

  // 缓存内容哈希避免重复解析
  const contentHashRef = React.useRef<string>('');

  // 当外部 content 变化时更新编辑器内容
  useEffect(() => {
    if (editor && isMounted) {
      // 使用简单哈希对比，避免重复解析相同内容
      const newHash = `${content.length}:${content.slice(0, 100)}:${content.slice(-100)}`;
      if (newHash === contentHashRef.current) return;

      const currentMarkdown = blocksToMarkdown(editor.document as never[]);
      if (currentMarkdown !== content) {
        contentHashRef.current = newHash;
        const newBlocks = parseMarkdownToBlocks(content);
        editor.replaceBlocks(editor.document, newBlocks as never[]);
      }
    }
  }, [content, editor, isMounted]);

  if (!isMounted) {
    return (
      <div className="h-full w-full flex items-center justify-center bg-white dark:bg-gray-900">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
      </div>
    );
  }

  return (
    <div className="h-full w-full bn-container">
      <BlockNoteView
        editor={editor}
        editable={editable}
        onChange={handleChange}
        theme={theme === 'dark' ? 'dark' : 'light'}
        slashMenu={false}
      >
        <SuggestionMenuController
          triggerCharacter={'/'}
          getItems={async (query) =>
            filterSuggestionItems(getCustomSlashMenuItems(editor), query)
          }
        />
      </BlockNoteView>
      <style jsx global>{`
        .bn-container {
          --bn-colors-editor-text: ${theme === 'dark' ? '#e5e7eb' : '#111827'};
          --bn-colors-editor-background: ${theme === 'dark' ? '#111827' : '#ffffff'};
          --bn-colors-menu-text: ${theme === 'dark' ? '#e5e7eb' : '#111827'};
          --bn-colors-menu-background: ${theme === 'dark' ? '#1f2937' : '#ffffff'};
          --bn-colors-tooltip-text: ${theme === 'dark' ? '#e5e7eb' : '#111827'};
          --bn-colors-tooltip-background: ${theme === 'dark' ? '#374151' : '#1f2937'};
          --bn-colors-hovered-text: ${theme === 'dark' ? '#e5e7eb' : '#111827'};
          --bn-colors-hovered-background: ${theme === 'dark' ? '#374151' : '#f3f4f6'};
          --bn-colors-selected-text: ${theme === 'dark' ? '#ffffff' : '#ffffff'};
          --bn-colors-selected-background: ${theme === 'dark' ? '#3b82f6' : '#3b82f6'};
          --bn-colors-disabled-text: ${theme === 'dark' ? '#6b7280' : '#9ca3af'};
          --bn-colors-border: ${theme === 'dark' ? '#374151' : '#e5e7eb'};
          --bn-colors-side-menu: ${theme === 'dark' ? '#9ca3af' : '#6b7280'};
          --bn-color-highlight-colors-gray-text: ${theme === 'dark' ? '#e5e7eb' : '#374151'};
          --bn-color-highlight-colors-gray-background: ${theme === 'dark' ? '#374151' : '#f3f4f6'};
          --bn-color-highlight-colors-brown-text: ${theme === 'dark' ? '#d6c0a6' : '#5d4037'};
          --bn-color-highlight-colors-brown-background: ${theme === 'dark' ? '#4a3b2a' : '#efebe9'};
          --bn-color-highlight-colors-orange-text: ${theme === 'dark' ? '#fdba74' : '#e65100'};
          --bn-color-highlight-colors-orange-background: ${theme === 'dark' ? '#7c2d12' : '#fff3e0'};
          --bn-color-highlight-colors-yellow-text: ${theme === 'dark' ? '#fde047' : '#f57f17'};
          --bn-color-highlight-colors-yellow-background: ${theme === 'dark' ? '#713f12' : '#fffde7'};
          --bn-color-highlight-colors-green-text: ${theme === 'dark' ? '#86efac' : '#1b5e20'};
          --bn-color-highlight-colors-green-background: ${theme === 'dark' ? '#14532d' : '#e8f5e9'};
          --bn-color-highlight-colors-blue-text: ${theme === 'dark' ? '#93c5fd' : '#0d47a1'};
          --bn-color-highlight-colors-blue-background: ${theme === 'dark' ? '#1e3a8a' : '#e3f2fd'};
          --bn-color-highlight-colors-purple-text: ${theme === 'dark' ? '#d8b4fe' : '#4a148c'};
          --bn-color-highlight-colors-purple-background: ${theme === 'dark' ? '#581c87' : '#f3e5f5'};
          --bn-color-highlight-colors-pink-text: ${theme === 'dark' ? '#f9a8d4' : '#880e4f'};
          --bn-color-highlight-colors-pink-background: ${theme === 'dark' ? '#831843' : '#fce4ec'};
          --bn-color-highlight-colors-red-text: ${theme === 'dark' ? '#fca5a5' : '#b71c1c'};
          --bn-color-highlight-colors-red-background: ${theme === 'dark' ? '#7f1d1d' : '#ffebee'};
          --bn-font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          --bn-border-radius: 8px;
        }
        
        .bn-container .bn-editor {
          padding: 1rem;
          min-height: 100%;
        }
        
        .bn-container .bn-block-outer {
          margin-bottom: 0.5rem;
        }
        
        .bn-container .bn-side-menu {
          opacity: 0;
          transition: opacity 0.2s;
        }
        
        .bn-container:hover .bn-side-menu {
          opacity: 1;
        }
      `}</style>
    </div>
  );
}
