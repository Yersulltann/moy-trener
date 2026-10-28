#!/bin/sh
# Выкладка на GitHub Pages: собирает приложение и пушит dist в ветку gh-pages.
set -e
cd "$(dirname "$0")"
npm run build
touch dist/.nojekyll
REMOTE=$(git remote get-url origin)
cd dist
rm -rf .git
git init -q -b gh-pages
git add -A
git commit -q -m "Deploy $(date '+%Y-%m-%d %H:%M')"
git push -f -q "$REMOTE" gh-pages
rm -rf .git
echo "Готово"
