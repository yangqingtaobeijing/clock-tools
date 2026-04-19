#!/usr/bin/env bash
set -e

echo "Building..."
npm run build

# Ensure .nojekyll exists in dist to prevent GitHub Pages Jekyll processing
touch dist/.nojekyll

echo "Deploying to gh-pages..."
npx gh-pages -d dist --dotfiles

echo "Deploy complete!"
