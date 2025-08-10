import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

export async function GET() {
  try {
    const filePath = path.join(process.cwd(), 'public', 'dictionary.transformed.json');
    const data = await fs.readFile(filePath, 'utf8');
    
    return new NextResponse(data, {
      headers: {
        'Content-Type': 'application/json',
        'Content-Encoding': 'identity', // Let Next.js handle compression
      },
    });
  } catch (error) {
    console.error('Error serving dictionary:', error);
    return new NextResponse('Dictionary not found', { status: 404 });
  }
}
