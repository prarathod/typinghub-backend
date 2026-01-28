# Quick Start: Deploy to EC2

## Prerequisites Checklist
- [ ] AWS EC2 instance running Ubuntu 20.04/22.04
- [ ] EC2 security group allows HTTP (80) and HTTPS (443)
- [ ] MongoDB Atlas connection string ready
- [ ] Vercel frontend URL ready
- [ ] Google OAuth credentials ready
- [ ] Razorpay keys ready

## Quick Deployment Steps

### 1. Initial Server Setup (One-time)

```bash
# SSH into your EC2 instance
ssh -i your-key.pem ubuntu@your-ec2-ip

# Run the setup script
wget https://raw.githubusercontent.com/your-repo/typinghub-backend/main/setup-ec2.sh
chmod +x setup-ec2.sh
./setup-ec2.sh

# OR manually:
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
sudo npm install -g pm2
pm2 startup
sudo apt install nginx git -y
```

### 2. Deploy Application

```bash
# Clone repository
cd /home/ubuntu
git clone https://github.com/your-username/typinghub-backend.git
cd typinghub-backend

# Create .env file
cp .env.example .env
nano .env  # Edit with your values

# Key values to set:
# - CLIENT_URL=https://your-app.vercel.app
# - GOOGLE_CALLBACK_URL=https://your-ec2-ip/auth/google/callback
# - MONGODB_URI=your-mongodb-connection-string

# Install and build
npm install
npm run build

# Start with PM2
pm2 start ecosystem.config.js
pm2 save
```

### 3. Configure Nginx

```bash
# Copy nginx config
sudo cp nginx.conf /etc/nginx/sites-available/typinghub-backend

# Edit server_name (replace with your EC2 IP or domain)
sudo nano /etc/nginx/sites-available/typinghub-backend

# Enable site
sudo ln -s /etc/nginx/sites-available/typinghub-backend /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### 4. Update Google OAuth

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. APIs & Services → Credentials
3. Edit OAuth 2.0 Client
4. Add redirect URI: `http://your-ec2-ip/auth/google/callback` (or HTTPS if using domain)

### 5. Update Frontend (Vercel)

In Vercel dashboard, add environment variable:
- **Name**: `NEXT_PUBLIC_API_URL`
- **Value**: `http://your-ec2-ip` (or `https://your-domain.com`)

### 6. Verify

```bash
# Check health endpoint
curl http://your-ec2-ip/health

# Check PM2
pm2 status
pm2 logs typinghub-backend
```

## Common Commands

```bash
# View logs
pm2 logs typinghub-backend

# Restart app
pm2 restart typinghub-backend

# Deploy updates
git pull
npm install
npm run build
pm2 restart typinghub-backend

# Check Nginx
sudo nginx -t
sudo systemctl status nginx
```

## Troubleshooting

**Port already in use:**
```bash
sudo lsof -i :4000
pm2 delete typinghub-backend
pm2 start ecosystem.config.js
```

**CORS errors:**
- Verify `CLIENT_URL` in `.env` matches your Vercel URL exactly
- Check for trailing slashes
- Restart PM2: `pm2 restart typinghub-backend`

**MongoDB connection failed:**
- Verify `MONGODB_URI` is correct
- Check MongoDB Atlas IP whitelist (add EC2 IP)
- Test connection: `node -e "require('dotenv').config(); require('mongoose').connect(process.env.MONGODB_URI).then(() => console.log('OK')).catch(e => console.error(e))"`

## Next: SSL Setup (Recommended)

```bash
sudo apt install certbot python3-certbot-nginx -y
sudo certbot --nginx -d your-domain.com
```

Then update:
- `.env`: `GOOGLE_CALLBACK_URL=https://your-domain.com/auth/google/callback`
- Google OAuth: Update redirect URI to HTTPS
- Vercel: Update `NEXT_PUBLIC_API_URL` to HTTPS
