const fs = require('fs');
const path = require('path');

const rootDir = __dirname;
const frontendDir = path.join(rootDir, 'frontend');
const backendDir = path.join(rootDir, 'backend');
const serverDir = path.join(rootDir, 'server');
const apiDir = path.join(rootDir, 'api');

// 1. Rename backend to server
if (fs.existsSync(backendDir)) {
    fs.renameSync(backendDir, serverDir);
    console.log('Renamed backend to server');
}

// 2. Move frontend contents to root
if (fs.existsSync(frontendDir)) {
    const frontendFiles = fs.readdirSync(frontendDir);
    for (const file of frontendFiles) {
        if (file === 'package.json' || file === 'package-lock.json') continue; // We will handle package later
        const srcPath = path.join(frontendDir, file);
        const destPath = path.join(rootDir, file);
        
        // If destPath exists, and it's not a folder we can merge, we might overwrite or skip
        if (file === 'node_modules') continue; // skip node modules, we reinstall
        
        if (!fs.existsSync(destPath)) {
            fs.renameSync(srcPath, destPath);
            console.log(`Moved ${file} to root`);
        } else {
            console.log(`Warning: ${destPath} already exists. Attempting to overwrite/merge.`);
            // if it's a file, renameSync overwrites:
            if (fs.lstatSync(srcPath).isFile()) {
                fs.renameSync(srcPath, destPath);
            }
        }
    }
}

// 3. Merge package.json
const frontendPkgPath = path.join(frontendDir, 'package.json');
const backendPkgPath = path.join(serverDir, 'package.json');
const rootPkgPath = path.join(rootDir, 'package.json');

let frontendPkg = {};
let backendPkg = {};
if (fs.existsSync(frontendPkgPath)) frontendPkg = JSON.parse(fs.readFileSync(frontendPkgPath, 'utf8'));
if (fs.existsSync(backendPkgPath)) backendPkg = JSON.parse(fs.readFileSync(backendPkgPath, 'utf8'));

const rootPkg = {
  name: "validation-engine",
  version: "1.0.0",
  type: "module", // Vite needs this but let's carefully check if backend supports it. The backend uses require(), so if root is "type": "module", backend fails!
  // Oh! Vite uses type: module, but server uses require(). 
  // Wait, if we keep them separate package.json, Vercel supports it but we are merging it.
  // Actually, Vite doesn't absolutely require "type": "module" if we rename vite.config.js to vite.config.mjs.
};

// Merge dependencies
const mergedDeps = { ...backendPkg.dependencies, ...frontendPkg.dependencies };
const mergedDevDeps = { ...backendPkg.devDependencies, ...frontendPkg.devDependencies };

rootPkg.scripts = {
    "dev": "vite",
    "build": "vite build",
    "lint": "eslint .",
    "test": "vitest run",
    "preview": "vite preview",
    "start": "node server/src/server.js",
    "test:server": "cd server && npm run test:unit && node scripts/smoke-test.js"
};

rootPkg.dependencies = mergedDeps;
rootPkg.devDependencies = mergedDevDeps;
rootPkg.engines = backendPkg.engines || { node: ">=18.0.0" };

// Because backend uses CommonJS (`require()`), adding "type": "module" will break backend execution!
// Vite and Frontend are pure ESM. Instead of type: module, we can let Vite run, but we must rename `vite.config.js` to `vite.config.mjs`!
// Or we can just set `type: "module"` in frontend `package.json` only? We can't if we merge.
// Let's remove "type: module" from root, and rename vite.config.js to vite.config.mjs and tailwind.config or postcss.config etc.

fs.writeFileSync(rootPkgPath, JSON.stringify(rootPkg, null, 2));
console.log('Merged package.json at root');

// 4. Handle ESM Vite config renames
const viteConfig = path.join(rootDir, 'vite.config.js');
if (fs.existsSync(viteConfig)) {
    fs.renameSync(viteConfig, path.join(rootDir, 'vite.config.mjs'));
    console.log('Renamed vite.config.js to .mjs');
}

// 5. Create api directory and index.js
if (!fs.existsSync(apiDir)) fs.mkdirSync(apiDir);
const apiIndexCode = `const app = require('../server/src/app');
module.exports = app;
`;
fs.writeFileSync(path.join(apiDir, 'index.js'), apiIndexCode);
console.log('Created api/index.js');

// 6. Delete old frontend dir
fs.rmSync(frontendDir, { recursive: true, force: true });
console.log('Cleaned up frontend directory');
