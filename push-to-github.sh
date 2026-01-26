#!/bin/bash

# Script to push typinghub-backend to GitHub
# Usage: ./push-to-github.sh YOUR_PERSONAL_ACCESS_TOKEN

if [ -z "$1" ]; then
    echo "❌ Error: Please provide your Personal Access Token"
    echo ""
    echo "Usage: ./push-to-github.sh YOUR_PERSONAL_ACCESS_TOKEN"
    echo ""
    echo "To get a token:"
    echo "1. Go to: https://github.com/settings/tokens"
    echo "2. Click 'Generate new token (classic)'"
    echo "3. Check 'repo' scope"
    echo "4. Generate and copy the token"
    exit 1
fi

TOKEN=$1
REPO_URL="https://prarathod:${TOKEN}@github.com/prarathod/typinghub-backend.git"

echo "🚀 Setting up remote with token..."
git remote set-url origin "$REPO_URL"

echo "📤 Pushing to GitHub..."
if git push -u origin main; then
    echo "✅ Push successful!"
    
    echo "🔒 Removing token from remote URL (for security)..."
    git remote set-url origin "https://github.com/prarathod/typinghub-backend.git"
    
    echo ""
    echo "✨ Done! Your code is now on GitHub."
    echo "🔗 View it at: https://github.com/prarathod/typinghub-backend"
else
    echo "❌ Push failed. Please check:"
    echo "   1. Token has 'repo' scope"
    echo "   2. Repository exists and you have access"
    echo "   3. Token is not expired"
    
    # Clean up on failure
    git remote set-url origin "https://github.com/prarathod/typinghub-backend.git"
    exit 1
fi
