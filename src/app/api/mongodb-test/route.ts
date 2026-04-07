import { NextResponse } from 'next/server';
import { MongoClient } from 'mongodb';

export const dynamic = 'force-static';

export async function POST(request: Request) {
  try {
    const { uri } = await request.json();

    if (!uri) {
      return NextResponse.json(
        { success: false, error: '缺少 MongoDB 连接字符串' },
        { status: 400 }
      );
    }

    // 创建客户端并连接
    const client = new MongoClient(uri);
    await client.connect();

    // 测试 ping
    const db = client.db('markdown_notes');
    await db.command({ ping: 1 });

    // 关闭连接
    await client.close();

    return NextResponse.json({
      success: true,
      message: 'MongoDB 连接成功',
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '未知错误';
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}
