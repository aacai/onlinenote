import { NextResponse } from 'next/server';
import { checkMongoDbConnection } from '@/lib/mongodb-api';

export const dynamic = 'force-static';

export async function POST(request: Request) {
  try {
    const success = await checkMongoDbConnection();
    
    if (success) {
      return NextResponse.json({
        success: true,
        message: 'MongoDB 连接成功',
      });
    } else {
      return NextResponse.json({
        success: false,
        error: 'MongoDB 连接失败，请检查 API Key 配置',
      }, { status: 500 });
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '未知错误';
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}
