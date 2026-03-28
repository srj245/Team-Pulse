const fs = require('fs');
const path = require('path');

function getActualFilename(dir, filename) {
    if (!fs.existsSync(dir)) return null;
    const files = fs.readdirSync(dir);
    return files.find(f => f === filename);
}

function checkPathCaseSensitive(baseDir, requestPath) {
    let currentDir = baseDir;
    
    // Resolve extension if omitted
    const extensions = ['.js', '.jsx', '.css', '/index.js', '/index.jsx', ''];
    let resolvedRequestPath = requestPath;
    let found = false;
    
    for (const ext of extensions) {
       let testPath = path.resolve(baseDir, requestPath + ext);
       if (fs.existsSync(testPath)) {
          resolvedRequestPath = requestPath + ext;
          found = true;
          break;
       }
    }
    
    if (!found) return { ok: false, error: 'File not found' };
    
    // Check case sensitive at each segment
    const fullPath = path.resolve(baseDir, resolvedRequestPath);
    const relPath = path.relative(process.cwd(), fullPath);
    const segments = relPath.split(path.sep);
    
    let target = process.cwd();
    for (const segment of segments) {
        if (!segment) continue;
        const actual = getActualFilename(target, segment);
        if (!actual) {
            return { ok: false, error: `Invalid case: expecting "${segment}" in ${target}` };
        }
        target = path.join(target, segment);
    }
    
    return { ok: true };
}

function scanFiles(dir) {
    let files = [];
    if (!fs.existsSync(dir)) return files;
    const list = fs.readdirSync(dir);
    for (const file of list) {
        if (file === 'node_modules' || file === '.git' || file === 'dist') continue;
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
            files = files.concat(scanFiles(fullPath));
        } else if (file.endsWith('.js') || file.endsWith('.jsx')) {
            files.push(fullPath);
        }
    }
    return files;
}

const allFiles = scanFiles(process.cwd());
let errors = 0;

for (const file of allFiles) {
    const content = fs.readFileSync(file, 'utf8');
    
    // Match require('...') and import ... from '...'
    const requireRegex = /(?:require|from)\s*\(\s*['"](\.[^'"]+)['"]\s*\)|(?:import|export).*?from\s*['"](\.[^'"]+)['"]/g;
    let match;
    while ((match = requireRegex.exec(content)) !== null) {
        const importPath = match[1] || match[2];
        if (!importPath) continue;
        
        const baseDir = path.dirname(file);
        const res = checkPathCaseSensitive(baseDir, importPath);
        if (!res.ok) {
            console.error(`\x1b[31m[ERROR]\x1b[0m ${file}`);
            console.error(`  Import: ${importPath}`);
            console.error(`  Reason: ${res.error}\n`);
            errors++;
        }
    }
}

if (errors > 0) {
    console.error(`Found ${errors} case-sensitive import issues.`);
    process.exit(1);
} else {
    console.log(`\x1b[32mAll relative imports are case-correct!\x1b[0m`);
}
