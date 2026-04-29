const fs = require('fs');
const path = require('path');

// Ensure you run this in the root of the workspace.
// It requires: npm install html-minifier-terser clean-css terser

const sourceDir = __dirname;
const distDir = path.join(__dirname, 'dist');
const assetsDir = path.join(distDir, 'assets');

// Create dist directories
if (!fs.existsSync(distDir)) {
    fs.mkdirSync(distDir);
}
if (!fs.existsSync(assetsDir)) {
    // Just a placeholder, we'll recursively copy assets
}

// Helper: recursively copy directory
function copyDir(src, dest) {
    if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
    let entries = fs.readdirSync(src, { withFileTypes: true });
    for (let entry of entries) {
        let srcPath = path.join(src, entry.name);
        let destPath = path.join(dest, entry.name);
        if (entry.isDirectory()) {
            copyDir(srcPath, destPath);
        } else {
            fs.copyFileSync(srcPath, destPath);
        }
    }
}

// Copy assets
if (fs.existsSync(path.join(sourceDir, 'assets'))) {
    copyDir(path.join(sourceDir, 'assets'), path.join(distDir, 'assets'));
}

async function optimizeFiles() {
    let minifyHtml, CleanCSS, minifyJs;
    try {
        minifyHtml = require('html-minifier-terser').minify;
        CleanCSS = require('clean-css');
        minifyJs = require('terser').minify;
    } catch (e) {
        console.error("Please run: npm install html-minifier-terser clean-css terser");
        process.exit(1);
    }

    const files = fs.readdirSync(sourceDir);

    for (const file of files) {
        const ext = path.extname(file);
        const sourcePath = path.join(sourceDir, file);
        const destPath = path.join(distDir, file);

        if (fs.statSync(sourcePath).isDirectory()) continue;

        if (ext === '.css') {
            console.log(`Minifying CSS: ${file}`);
            const cssContent = fs.readFileSync(sourcePath, 'utf8');
            const output = new CleanCSS({}).minify(cssContent);
            fs.writeFileSync(destPath, output.styles);
        } else if (ext === '.js') {
            // Skip optimizer itself
            if (file === 'optimize.js' || file === 'build_about.js' || file === 'patch_pages.js') continue;
            console.log(`Minifying JS: ${file}`);
            const jsContent = fs.readFileSync(sourcePath, 'utf8');
            const output = await minifyJs(jsContent);
            fs.writeFileSync(destPath, output.code);
        } else if (ext === '.html') {
            console.log(`Processing HTML: ${file}`);
            let content = fs.readFileSync(sourcePath, 'utf8');

            // 1. Eliminate render-blocking for Google Fonts & Font Awesome
            content = content.replace(
                /<link([^>]+href="https:\/\/fonts\.googleapis\.com[^"]+"[^>]*)>/g,
                `<link$1 media="print" onload="this.media='all'">`
            );
            content = content.replace(
                /<link([^>]+href="https:\/\/cdnjs\.cloudflare\.com\/ajax\/libs\/font-awesome[^"]+"[^>]*)>/g,
                `<link$1 media="print" onload="this.media='all'">`
            );

            // 2. Defer custom JS to prevent render blocking
            content = content.replace(/<script src="landing\.js"><\/script>/g, `<script src="landing.js" defer></script>`);

            // 3. Lazy Load Images (excluding the first couple images that might be in hero)
            let imgIndex = 0;
            content = content.replace(/<img\s([^>]+)>/g, (match, attrs) => {
                imgIndex++;
                // Skip the first 3 images which are usually Logo and Hero images
                if (imgIndex <= 3) return match;
                // If already has loading attribute, skip
                if (attrs.includes('loading=')) return match;
                return `<img loading="lazy" ${attrs}>`;
            });

            // 4. Inline Minimal Critical CSS (Navbar & Body baseline)
            const criticalCss = `
            <style>
                body { background-color: #050505; color: #ffffff; font-family: 'Outfit', sans-serif; margin: 0; }
                .nav-wrapper { position: fixed; top: 20px; left: 50%; transform: translateX(-50%); z-index: 1000; width: 90%; max-width: 1200px; }
                .navbar { background: rgba(5, 5, 5, 0.4); backdrop-filter: blur(20px); border-radius: 50px; padding: 10px 20px; }
            </style>
            `;
            // Insert critical CSS before </head>
            content = content.replace(/<\/head>/i, `${criticalCss}\n</head>`);

            // Minify HTML
            const minified = await minifyHtml(content, {
                collapseWhitespace: true,
                removeComments: true,
                minifyJS: true,
                minifyCSS: true
            });
            fs.writeFileSync(destPath, minified);
        } else {
            // Just copy robots.txt, sitemap, etc.
            if (file !== 'optimize.js' && !file.startsWith('.')) {
                fs.copyFileSync(sourcePath, destPath);
            }
        }
    }
    console.log('Optimization complete! Output is in the /dist folder.');
}

optimizeFiles().catch(console.error);
