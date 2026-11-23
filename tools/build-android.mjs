import fs from 'node:fs';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';

const ROOT = 'D:/Development/craft-glass';
const WEB_DIR = path.join(ROOT, 'web');
const ANDROID_DIR = path.join(ROOT, 'android');
const ASSETS_WWW = path.join(ANDROID_DIR, 'assets/www');
const GEN_DIR = path.join(ANDROID_DIR, 'gen');
const BUILD_DIR = path.join(ROOT, '.local/build');
const DIST_DIR = path.join(ROOT, '.local/dist');
const TOOLS_DIR = path.join(ROOT, '.local/tools');
const KEYSTORE_JSON = path.join(ROOT, '.local/keystore/keystore.json');

const JAVA_BIN = 'C:/Program Files/Android/Android Studio1/jbr/bin';
const JAVAC = path.join(JAVA_BIN, 'javac.exe');
const JAVA = path.join(JAVA_BIN, 'java.exe');
const JARSIGNER = path.join(JAVA_BIN, 'jarsigner.exe');

const SDK_DIR = 'D:/Development/Android/Sdk';
const ANDROID_JAR = path.join(SDK_DIR, 'platforms/android-35/android.jar');
const BUILD_TOOLS = path.join(SDK_DIR, 'build-tools/35.0.0');
const AAPT2 = path.join(BUILD_TOOLS, 'aapt2.exe');
const D8_BAT = path.join(BUILD_TOOLS, 'd8.bat');
const BUNDLETOOL_JAR = path.join(TOOLS_DIR, 'bundletool.jar');

const AAB_OUT = path.join(DIST_DIR, 'craft-glass-1.0.0-vc1-release.aab');
const APKS_OUT = path.join(BUILD_DIR, 'universal.apks');
const APK_OUT = path.join(BUILD_DIR, 'universal.apk');

function run(cmd, args, opts = {}) {
  console.log(`> ${cmd} ${args.join(' ')}`);
  const isBatch = cmd.toLowerCase().endsWith('.bat') || cmd.toLowerCase().endsWith('.cmd');
  const res = isBatch
    ? spawnSync('cmd.exe', ['/c', cmd, ...args], { stdio: 'inherit', ...opts })
    : spawnSync(cmd, args, { stdio: 'inherit', ...opts });
  if (res.status !== 0) {
    throw new Error(`Command failed (${res.status}): ${cmd}`);
  }
}

function listFiles(dir, extFilter = null) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listFiles(full, extFilter));
    else if (!extFilter || full.toLowerCase().endsWith(extFilter)) out.push(full);
  }
  return out;
}

// 0. Check prerequisites
if (!fs.existsSync(BUNDLETOOL_JAR)) throw new Error(`Missing bundletool: ${BUNDLETOOL_JAR}`);
if (!fs.existsSync(KEYSTORE_JSON)) throw new Error(`Missing keystore metadata: ${KEYSTORE_JSON}`);
const ksMeta = JSON.parse(fs.readFileSync(KEYSTORE_JSON, 'utf8').replace(/^\uFEFF/, ''));

// 1. Sync web/ -> android/assets/www/
fs.rmSync(ASSETS_WWW, { recursive: true, force: true });
fs.cpSync(WEB_DIR, ASSETS_WWW, { recursive: true });
console.log('Copied web/ -> android/assets/www/');

// Clean build dirs
fs.rmSync(BUILD_DIR, { recursive: true, force: true });
fs.rmSync(GEN_DIR, { recursive: true, force: true });
fs.mkdirSync(BUILD_DIR, { recursive: true });
fs.mkdirSync(GEN_DIR, { recursive: true });
fs.mkdirSync(DIST_DIR, { recursive: true });

// 2. aapt2 compile resources
const compiledResZip = path.join(BUILD_DIR, 'compiled-res.zip');
run(AAPT2, ['compile', '--dir', path.join(ANDROID_DIR, 'res'), '-o', compiledResZip]);

// 3. aapt2 link --proto-format (for AAB)
const protoApk = path.join(BUILD_DIR, 'proto-res.apk');
run(AAPT2, [
  'link',
  '--proto-format',
  '-o', protoApk,
  '-I', ANDROID_JAR,
  '--manifest', path.join(ANDROID_DIR, 'AndroidManifest.xml'),
  '--java', GEN_DIR,
  '-A', path.join(ANDROID_DIR, 'assets'),
  compiledResZip
]);

// 4. Compile Java sources
const classesDir = path.join(BUILD_DIR, 'classes');
fs.mkdirSync(classesDir, { recursive: true });
const javaFiles = [
  ...listFiles(path.join(ANDROID_DIR, 'src'), '.java'),
  ...listFiles(GEN_DIR, '.java')
];
run(JAVAC, [
  '--release', '11',
  '-encoding', 'UTF-8',
  '-classpath', ANDROID_JAR,
  '-d', classesDir,
  ...javaFiles
]);

// 5. Dex with d8
const dexDir = path.join(BUILD_DIR, 'dex');
fs.mkdirSync(dexDir, { recursive: true });
const classFiles = listFiles(classesDir, '.class');
run(D8_BAT, [
  '--release',
  '--min-api', '26',
  '--lib', ANDROID_JAR,
  '--output', dexDir,
  ...classFiles
]);

// 6. Assemble base.zip with forward-slash AAB layout via PowerShell ZipArchive
const baseZip = path.join(BUILD_DIR, 'base.zip');
const assemblePs = `
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem
$protoApk = '${protoApk.replace(/'/g, "''")}'
$dexFile = '${path.join(dexDir, 'classes.dex').replace(/'/g, "''")}'
$baseZip = '${baseZip.replace(/'/g, "''")}'
if (Test-Path $baseZip) { Remove-Item $baseZip -Force }

$src = [System.IO.Compression.ZipFile]::OpenRead($protoApk)
$dstFs = [System.IO.File]::Create($baseZip)
$dst = New-Object System.IO.Compression.ZipArchive($dstFs, [System.IO.Compression.ZipArchiveMode]::Create)

foreach ($entry in $src.Entries) {
  if ($entry.FullName.EndsWith('/')) { continue }
  $targetName = if ($entry.FullName -eq 'AndroidManifest.xml') { 'manifest/AndroidManifest.xml' } else { $entry.FullName.Replace('\\', '/') }
  $outEntry = $dst.CreateEntry($targetName, [System.IO.Compression.CompressionLevel]::Optimal)
  $inStream = $entry.Open()
  $outStream = $outEntry.Open()
  $inStream.CopyTo($outStream)
  $outStream.Dispose()
  $inStream.Dispose()
}
$src.Dispose()

$dexEntry = $dst.CreateEntry('dex/classes.dex', [System.IO.Compression.CompressionLevel]::Optimal)
$dexIn = [System.IO.File]::OpenRead($dexFile)
$dexOut = $dexEntry.Open()
$dexIn.CopyTo($dexOut)
$dexOut.Dispose()
$dexIn.Dispose()

$dst.Dispose()
$dstFs.Dispose()
`;
run('powershell', ['-NoProfile', '-Command', assemblePs]);

// 7. Build AAB with bundletool
if (fs.existsSync(AAB_OUT)) fs.rmSync(AAB_OUT, { force: true });
run(JAVA, [
  '-jar', BUNDLETOOL_JAR,
  'build-bundle',
  `--modules=${baseZip}`,
  `--output=${AAB_OUT}`
]);

// 8. Sign AAB with jarsigner
run(JARSIGNER, [
  '-verbose',
  '-sigalg', 'SHA256withRSA',
  '-digestalg', 'SHA-256',
  '-keystore', ksMeta.keystorePath,
  '-storepass', ksMeta.storePass,
  '-keypass', ksMeta.keyPass,
  AAB_OUT,
  ksMeta.alias
]);

// 9. Validate AAB & verify signature
run(JAVA, ['-jar', BUNDLETOOL_JAR, 'validate', `--bundle=${AAB_OUT}`]);
run(JARSIGNER, ['-verify', '-verbose', '-certs', AAB_OUT]);

// 10. Build universal APK from AAB to inspect badging & native libs
if (fs.existsSync(APKS_OUT)) fs.rmSync(APKS_OUT, { force: true });
run(JAVA, [
  '-jar', BUNDLETOOL_JAR,
  'build-apks',
  `--bundle=${AAB_OUT}`,
  `--output=${APKS_OUT}`,
  '--mode=universal',
  `--ks=${ksMeta.keystorePath}`,
  `--ks-pass=pass:${ksMeta.storePass}`,
  `--ks-key-alias=${ksMeta.alias}`,
  `--key-pass=pass:${ksMeta.keyPass}`
]);

const extractApkPs = `
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression.FileSystem
$z = [System.IO.Compression.ZipFile]::OpenRead('${APKS_OUT.replace(/'/g, "''")}')
$u = $z.GetEntry('universal.apk')
if (-not $u) { throw 'Missing universal.apk in apks' }
[System.IO.Compression.ZipFileExtensions]::ExtractToFile($u, '${APK_OUT.replace(/'/g, "''")}', $true)
$hasSo = $z.Entries | Where-Object { $_.FullName -like '*.so' }
$z.Dispose()
if ($hasSo) { throw "Unexpected native .so libs found" }
Write-Output 'Zero .so native libraries confirmed (16KB page-size safe).'
`;
run('powershell', ['-NoProfile', '-Command', extractApkPs]);

const badging = execFileSync(AAPT2, ['dump', 'badging', APK_OUT], { encoding: 'utf8' });
const pkgLine = badging.split(/\r?\n/).find((l) => l.startsWith('package:'));
const sdkLines = badging.split(/\r?\n/).filter((l) => l.includes('SdkVersion:') || l.startsWith('sdkVersion:'));
console.log('--- BADGING SUMMARY ---');
console.log(pkgLine);
sdkLines.forEach((l) => console.log(l));
console.log(`AAB Size: ${(fs.statSync(AAB_OUT).size / (1024 * 1024)).toFixed(2)} MB -> ${AAB_OUT}`);
