import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const ROOT = 'D:/Development/craft-glass';
const LIBS_DIR = path.join(ROOT, '.local/libs');
const ARTIFACTS_DIR = path.join(LIBS_DIR, 'artifacts');
const JARS_DIR = path.join(LIBS_DIR, 'jars');
const RES_DIR = path.join(LIBS_DIR, 'res');
const MANIFEST_OUT = path.join(LIBS_DIR, 'manifest.json');

const REPOS = [
  'https://dl.google.com/dl/android/maven2',
  'https://repo1.maven.org/maven2'
];

function cmpVer(a, b) {
  const pa = String(a).split(/[\.\-]/).map((x) => (/^\d+$/.test(x) ? Number(x) : x));
  const pb = String(b).split(/[\.\-]/).map((x) => (/^\d+$/.test(x) ? Number(x) : x));
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const x = pa[i] ?? 0;
    const y = pb[i] ?? 0;
    if (typeof x === 'number' && typeof y === 'number') {
      if (x !== y) return x - y;
    } else if (String(x) !== String(y)) {
      return String(x) < String(y) ? -1 : 1;
    }
  }
  return 0;
}

const textCache = new Map();
async function fetchText(url) {
  if (textCache.has(url)) return textCache.get(url);
  const res = await fetch(url);
  const txt = res.ok ? await res.text() : null;
  textCache.set(url, txt);
  return txt;
}

async function fetchBuffer(url) {
  const res = await fetch(url);
  if (!res.ok) return null;
  return Buffer.from(await res.arrayBuffer());
}

function resolveProps(str, props) {
  return String(str || '').replace(/\$\{([^}]+)\}/g, (_, k) => props[k] ?? _);
}

const resolved = new Map(); // group:artifact -> { group, artifact, version, packaging }
const queued = new Set();

async function resolveTree(group, artifact, version) {
  const key = `${group}:${artifact}`;
  const prev = resolved.get(key);
  if (prev && cmpVer(prev.version, version) >= 0) return;

  const basePath = `${group.replace(/\./g, '/')}/${artifact}/${version}/${artifact}-${version}`;
  let pomXml = null;
  let repoFound = null;
  for (const repo of REPOS) {
    pomXml = await fetchText(`${repo}/${basePath}.pom`);
    if (pomXml) { repoFound = repo; break; }
  }
  if (!pomXml) throw new Error(`POM not found: ${key}:${version}`);

  const packaging = (pomXml.match(/<packaging>([^<]+)<\/packaging>/)?.[1] || 'jar').trim();
  resolved.set(key, { group, artifact, version, packaging, basePath, repo: repoFound });

  const visitKey = `${key}:${version}`;
  if (queued.has(visitKey)) return;
  queued.add(visitKey);

  const props = { 'project.version': version };
  const pm = pomXml.match(/<properties>([\s\S]*?)<\/properties>/);
  if (pm) {
    for (const m of pm[1].matchAll(/<([^>\s/]+)>([^<]+)<\/\1>/g)) {
      props[m[1]] = m[2].trim();
    }
  }

  const dm = pomXml.match(/<dependencies>([\s\S]*?)<\/dependencies>/);
  if (!dm) return;
  for (const d of dm[1].matchAll(/<dependency>([\s\S]*?)<\/dependency>/g)) {
    const b = d[1];
    const scope = (b.match(/<scope>([^<]+)<\/scope>/)?.[1] || 'compile').trim();
    const opt = (b.match(/<optional>([^<]+)<\/optional>/)?.[1] || 'false').trim();
    if (scope === 'test' || scope === 'provided' || opt === 'true') continue;
    const dg = resolveProps((b.match(/<groupId>([^<]+)<\/groupId>/)?.[1] || '').trim(), props);
    const da = resolveProps((b.match(/<artifactId>([^<]+)<\/artifactId>/)?.[1] || '').trim(), props);
    let dv = resolveProps((b.match(/<version>([^<]+)<\/version>/)?.[1] || '').trim(), props)
      .replace(/[\[\]\(\)]/g, '')
      .split(',')[0]
      .trim();
    if (dg && da && dv && !dv.includes('$')) {
      await resolveTree(dg, da, dv);
    }
  }
}

await resolveTree('com.android.billingclient', 'billing', '7.1.1');
// Ensure Guava ListenableFuture (used by BillingClient futures / concurrent) is present if referenced
await resolveTree('com.google.guava', 'listenablefuture', '1.0');

fs.rmSync(JARS_DIR, { recursive: true, force: true });
fs.rmSync(RES_DIR, { recursive: true, force: true });
fs.mkdirSync(ARTIFACTS_DIR, { recursive: true });
fs.mkdirSync(JARS_DIR, { recursive: true });
fs.mkdirSync(RES_DIR, { recursive: true });

const packages = [];
const resDirs = [];
const jars = [];

for (const item of resolved.values()) {
  const ext = item.packaging === 'aar' ? 'aar' : 'jar';
  const slug = `${item.group}__${item.artifact}`.replace(/[^a-zA-Z0-9._-]/g, '_');
  const filePath = path.join(ARTIFACTS_DIR, `${slug}-${item.version}.${ext}`);

  if (!fs.existsSync(filePath)) {
    let buf = await fetchBuffer(`${item.repo}/${item.basePath}.${ext}`);
    if (!buf) {
      for (const r of REPOS) {
        buf = await fetchBuffer(`${r}/${item.basePath}.${ext}`);
        if (buf) break;
      }
    }
    if (!buf) throw new Error(`Failed downloading ${item.group}:${item.artifact}:${item.version}.${ext}`);
    fs.writeFileSync(filePath, buf);
  }

  if (ext === 'jar') {
    const outJar = path.join(JARS_DIR, `${slug}.jar`);
    fs.copyFileSync(filePath, outJar);
    jars.push(outJar);
  } else {
    const tmpDir = path.join(LIBS_DIR, 'tmp_extract', slug);
    fs.rmSync(tmpDir, { recursive: true, force: true });
    fs.mkdirSync(tmpDir, { recursive: true });
    const ps = `
      Add-Type -AssemblyName System.IO.Compression.FileSystem
      [System.IO.Compression.ZipFile]::ExtractToDirectory('${filePath.replace(/'/g, "''")}', '${tmpDir.replace(/'/g, "''")}')
    `;
    execFileSync('powershell', ['-NoProfile', '-Command', ps]);

    const mfPath = path.join(tmpDir, 'AndroidManifest.xml');
    if (fs.existsSync(mfPath)) {
      const mf = fs.readFileSync(mfPath, 'utf8');
      const pkg = mf.match(/package\s*=\s*"([^"]+)"/)?.[1];
      if (pkg && !packages.includes(pkg)) packages.push(pkg);
    }

    const classesJar = path.join(tmpDir, 'classes.jar');
    if (fs.existsSync(classesJar) && fs.statSync(classesJar).size > 22) {
      const outJar = path.join(JARS_DIR, `${slug}.jar`);
      fs.copyFileSync(classesJar, outJar);
      jars.push(outJar);
    }

    const libsSub = path.join(tmpDir, 'libs');
    if (fs.existsSync(libsSub)) {
      for (const f of fs.readdirSync(libsSub)) {
        if (f.endsWith('.jar')) {
          const outSub = path.join(JARS_DIR, `${slug}__${f}`);
          fs.copyFileSync(path.join(libsSub, f), outSub);
          jars.push(outSub);
        }
      }
    }

    const aarRes = path.join(tmpDir, 'res');
    if (fs.existsSync(aarRes)) {
      const hasFiles = fs.readdirSync(aarRes, { recursive: true }).some((rel) => {
        const p = path.join(aarRes, String(rel));
        return fs.statSync(p).isFile();
      });
      if (hasFiles) {
        const outRes = path.join(RES_DIR, slug);
        fs.cpSync(aarRes, outRes, { recursive: true });
        resDirs.push({ slug, dir: outRes });
      }
    }
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

fs.rmSync(path.join(LIBS_DIR, 'tmp_extract'), { recursive: true, force: true });

// Compute total footprint
let totalBytes = 0;
const walkSize = (d) => {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walkSize(p);
    else totalBytes += fs.statSync(p).size;
  }
};
walkSize(LIBS_DIR);

const manifest = {
  generatedAt: new Date().toISOString(),
  count: resolved.size,
  totalMB: Number((totalBytes / (1024 * 1024)).toFixed(2)),
  packages,
  resDirs,
  jars
};
fs.writeFileSync(MANIFEST_OUT, JSON.stringify(manifest, null, 2));
console.log(`Resolved ${manifest.count} Maven artifacts -> ${jars.length} JARs, ${resDirs.length} resource overlays, ${packages.length} packages (${manifest.totalMB} MB).`);
