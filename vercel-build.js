const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Run the Angular build
console.log('Building Angular application...');
execSync('npm run build', { stdio: 'inherit' });

// Create the monaco directory in assets if it doesn't exist
const monacoDir = path.join(__dirname, 'dist', 'interview', 'assets', 'monaco');
if (!fs.existsSync(monacoDir)) {
  console.log('Creating monaco directory in assets...');
  fs.mkdirSync(monacoDir, { recursive: true });
}

// Copy monaco-editor files from node_modules to assets
const monacoSrc = path.join(__dirname, 'node_modules', 'monaco-editor', 'min');
const monacoDest = path.join(monacoDir, 'min');

console.log('Copying monaco-editor files to assets...');
if (fs.existsSync(monacoSrc)) {
  // Create the destination directory if it doesn't exist
  if (!fs.existsSync(monacoDest)) {
    fs.mkdirSync(monacoDest, { recursive: true });
  }
  
  // Copy the files recursively
  copyFolderRecursiveSync(monacoSrc, monacoDir);
  console.log('Monaco editor files copied successfully.');
} else {
  console.error('Monaco editor source directory not found:', monacoSrc);
}

// Function to copy a folder recursively
function copyFolderRecursiveSync(source, target) {
  // Check if source exists
  if (!fs.existsSync(source)) {
    return;
  }

  // Create target folder if it doesn't exist
  const targetFolder = path.join(target, path.basename(source));
  if (!fs.existsSync(targetFolder)) {
    fs.mkdirSync(targetFolder, { recursive: true });
  }

  // Copy each file in the source folder
  const files = fs.readdirSync(source);
  files.forEach(file => {
    const sourcePath = path.join(source, file);
    const targetPath = path.join(targetFolder, file);
    
    if (fs.lstatSync(sourcePath).isDirectory()) {
      // Recursively copy subdirectories
      copyFolderRecursiveSync(sourcePath, targetFolder);
    } else {
      // Copy file
      fs.copyFileSync(sourcePath, targetPath);
    }
  });
}
