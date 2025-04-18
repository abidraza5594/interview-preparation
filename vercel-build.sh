#!/bin/bash

# Install dependencies
echo "Installing dependencies..."
npm install --legacy-peer-deps --force

# Build the application with increased memory allocation
echo "Building the application..."
NODE_OPTIONS="--max-old-space-size=4096" npm run build

# Create the output directory if it doesn't exist
mkdir -p dist/interview

# Success message
echo "Build completed successfully!"
