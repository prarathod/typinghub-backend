# How to Push Backend to GitHub

## Step 1: Create a New Personal Access Token

1. Go to: https://github.com/settings/tokens
2. Click **"Generate new token"** → **"Generate new token (classic)"**
3. Give it a name: `typinghub-backend-push`
4. Select expiration: Choose your preference (30 days, 90 days, or no expiration)
5. **IMPORTANT:** Check the **`repo`** scope (this gives full repository access)
6. Scroll down and click **"Generate token"**
7. **COPY THE TOKEN IMMEDIATELY** - you won't see it again!

## Step 2: Revoke the Old Token

1. On the same tokens page, find the old token you shared
2. Click the **trash icon** to delete it (for security)

## Step 3: Push Using the New Token

Run these commands in your terminal:

```bash
cd /Users/prajwal/Documents/work/typinghub/typinghub-backend

# Replace YOUR_NEW_TOKEN with the token you just created
git remote set-url origin "https://prarathod:YOUR_NEW_TOKEN@github.com/prarathod/typinghub-backend.git"

# Push your code
git push -u origin main

# After successful push, remove token from URL (for security)
git remote set-url origin "https://github.com/prarathod/typinghub-backend.git"
```

## Alternative: Use Git Credential Helper (Recommended)

This saves your token securely so you don't need to enter it every time:

```bash
cd /Users/prajwal/Documents/work/typinghub/typinghub-backend

# Configure Git to use macOS Keychain
git config --global credential.helper osxkeychain

# Set remote to standard URL
git remote set-url origin "https://github.com/prarathod/typinghub-backend.git"

# Push (it will prompt for username and password)
git push -u origin main
```

When prompted:
- **Username:** `prarathod`
- **Password:** Paste your **Personal Access Token** (not your GitHub password)

The token will be saved in macOS Keychain for future use.

## Verify Push Was Successful

After pushing, check:
1. Go to: https://github.com/prarathod/typinghub-backend
2. You should see all your files including `src/`, `package.json`, etc.
