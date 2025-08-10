import fs from 'fs';
import path from 'path';
import { gzipSync } from 'zlib';

interface OriginalEntry {
  s: string; // simplified
  r?: string; // radical  
  l?: string[]; // level
  q?: number; // frequency
  p?: string[]; // pos (parts of speech)
  f: { // forms
    t: string; // traditional
    i: { // transcriptions/info
      y: string; // pinyin
      n?: string; // numeric
      w?: string; // wadegiles
      b?: string; // bopomofo
      g?: string; // gwoyeu romatzyh
    };
    m: string[]; // meanings
    c?: string[]; // classifiers
  }[];
}

interface TransformedEntry {
  simplified: string;
  traditional: string;
  pinyin: string;
  meanings: string[];
  radical?: string;
  frequency?: number;
  level?: string[];
  pos?: string[];
}

async function transformDictionary() {
  console.log('🔄 Loading original dictionary...');
  
  const inputPath = path.join(process.cwd(), 'dictionary.min.json');
  const outputPath = path.join(process.cwd(), 'public', 'dictionary.transformed.json');
  const gzippedPath = path.join(process.cwd(), 'public', 'dictionary.transformed.json.gz');
  
  // Check if input file exists
  if (!fs.existsSync(inputPath)) {
    console.error(`❌ Input file not found: ${inputPath}`);
    process.exit(1);
  }

  // Ensure public directory exists
  const publicDir = path.join(process.cwd(), 'public');
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
  }

  // Read original dictionary
  const originalData = JSON.parse(fs.readFileSync(inputPath, 'utf8')) as OriginalEntry[];
  
  console.log(`📊 Original entries: ${originalData.length}`);
  
  const transformedEntries: TransformedEntry[] = [];
  
  // Transform each entry
  for (const entry of originalData) {
    // Each form becomes a separate entry
    for (const form of entry.f || []) {
      transformedEntries.push({
        simplified: entry.s,
        traditional: form.t,
        pinyin: form.i.y,
        meanings: form.m || [],
        radical: entry.r,
        frequency: entry.q,
        level: entry.l,
        pos: entry.p
      });
    }
  }
  
  console.log(`📊 Transformed entries: ${transformedEntries.length}`);
  
  // Write transformed JSON
  const transformedJson = JSON.stringify(transformedEntries);
  fs.writeFileSync(outputPath, transformedJson, 'utf8');
  
  // Create gzipped version
  const gzipped = gzipSync(transformedJson);
  fs.writeFileSync(gzippedPath, gzipped);
  
  // Calculate sizes
  const originalSize = fs.statSync(inputPath).size;
  const transformedSize = fs.statSync(outputPath).size;
  const gzippedSize = fs.statSync(gzippedPath).size;
  
  console.log('📈 Size comparison:');
  console.log(`  Original: ${(originalSize / 1024 / 1024).toFixed(2)} MB`);
  console.log(`  Transformed: ${(transformedSize / 1024 / 1024).toFixed(2)} MB`);
  console.log(`  Gzipped: ${(gzippedSize / 1024 / 1024).toFixed(2)} MB`);
  console.log(`  Compression ratio: ${((1 - gzippedSize / originalSize) * 100).toFixed(1)}%`);
  
  console.log('✅ Dictionary transformation complete!');
  console.log(`📁 Files created:`);
  console.log(`  - ${outputPath}`);
  console.log(`  - ${gzippedPath}`);
}

transformDictionary().catch(console.error);
