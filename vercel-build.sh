#!/bin/bash

# Install dependencies
echo "Installing dependencies..."
npm install --legacy-peer-deps

# Build the application
echo "Building the application..."
npm run build

# Create the output directory if it doesn't exist
mkdir -p dist/interview

# Success message
echo "Build completed successfully!"
