-- Supabase 数据库表结构
-- 在 Supabase SQL Editor 中执行此脚本

-- 创建 notes 表
CREATE TABLE IF NOT EXISTS public.notes (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL DEFAULT '无标题笔记',
    content TEXT NOT NULL DEFAULT '',
    category TEXT NOT NULL DEFAULT '4',
    tags TEXT[] DEFAULT '{}',
    createdAt BIGINT NOT NULL,
    updatedAt BIGINT NOT NULL
);

-- 创建 categories 表
CREATE TABLE IF NOT EXISTS public.categories (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    color TEXT NOT NULL DEFAULT '#3b82f6'
);

-- 添加默认分类
INSERT INTO public.categories (id, name, color) VALUES
    ('1', '工作', '#3b82f6'),
    ('2', '学习', '#10b981'),
    ('3', '生活', '#f59e0b'),
    ('4', '其他', '#6b7280')
ON CONFLICT (id) DO NOTHING;

-- 启用 RLS (Row Level Security) - 可选，如果需要权限控制
ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

-- 创建允许所有访问的策略（开发环境用）
-- 生产环境应该根据需求调整权限
CREATE POLICY "Allow all" ON public.notes
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all" ON public.categories
    FOR ALL USING (true) WITH CHECK (true);

-- 创建索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_notes_updatedAt ON public.notes(updatedAt DESC);
CREATE INDEX IF NOT EXISTS idx_notes_category ON public.notes(category);
CREATE INDEX IF NOT EXISTS idx_categories_name ON public.categories(name);
