#!/usr/bin/env node

/**
 * Скрипт для создания standalone HTML файла
 * Используется для деплоя на GitHub Pages или открытия локально
 */

const fs = require('fs');
const path = require('path');

const distDir = path.join(__dirname, 'dist');
const outputFile = path.join(__dirname, 'neon-cyber-spin.html');

// Читаем index.html
const indexHtml = fs.readFileSync(path.join(distDir, 'index.html'), 'utf-8');

// Читаем JS и CSS файлы
const assetsDir = path.join(distDir, 'assets');
const files = fs.readdirSync(assetsDir);

const jsFile = files.find(f => f.endsWith('.js'));
const cssFile = files.find(f => f.endsWith('.css'));

const jsContent = fs.readFileSync(path.join(assetsDir, jsFile), 'utf-8');
const cssContent = fs.readFileSync(path.join(assetsDir, cssFile), 'utf-8');

// Заменяем ссылки на инлайновый контент
let standaloneHtml = indexHtml
  .replace(/<script type="module" crossorigin src="[^"]+"><\/script>/, `<script type="module">${jsContent}</script>`)
  .replace(/<link rel="stylesheet" crossorigin href="[^"]+">/, `<style>${cssContent}</style>`);

// Сохраняем результат
fs.writeFileSync(outputFile, standaloneHtml, 'utf-8');

console.log('✅ Standalone HTML файл создан: neon-cyber-spin.html');
console.log('📁 Размер:', (fs.statSync(outputFile).size / 1024).toFixed(2), 'KB');
console.log('');
console.log('🚀 Как использовать:');
console.log('   1. Откройте neon-cyber-spin.html в браузере');
console.log('   2. Или загрузите на GitHub Pages');
