# EC2 Deployment Guide for TypingHub Backend

This guide will help you deploy the TypingHub backend on AWS EC2 and configure it to work with your Vercel frontend.

## Prerequisites

- AWS EC2 instance (Ubuntu 20.04 or 22.04 recommended)
- Domain name (optional, but recommended)
- MongoDB Atlas account (or MongoDB instance)
- Google OAuth credentials
- Razorpay account

## Step 1: Initial EC2 Setup

### 1.1 Connect to your EC2 instance

```bash
ssh -i your-key.pem ubuntu@your-ec2-ip
```

### 1.2 Update system packages

```bash
sudo apt update && sudo apt upgrade -y
```

### 1.3 Install Node.js (v18 or higher)

```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
node --version  # Verify installation
```

### 1.4 Install PM2 (Process Manager)

```bash
sudo npm install -g pm2
pm2 startup  # Follow the instructions to enable PM2 on system startup
```

### 1.5 Install Nginx (Reverse Proxy)

```bash
sudo apt install nginx -y
sudo systemctl enable nginx
sudo systemctl start nginx
```

### 1.6 Install Git

```bash
sudo apt install git -y
```

## Step 2: Configure Security Groups

In AWS EC2 Console:

1. Go to **Security Groups** → Select your instance's security group
2. Add inbound rules:
   - **Type**: HTTP, **Port**: 80, **Source**: 0.0.0.0/0
   - **Type**: HTTPS, **Port**: 443, **Source**: 0.0.0.0/0
   - **Type**: Custom TCP, **Port**: 4000, **Source**: Your IP (for testing, or remove after Nginx setup)

## Step 3: Deploy Application

### 3.1 Clone your repository

```bash
cd /home/ubuntu
git clone https://github.com/your-username/typinghub-backend.git
cd typinghub-backend
```

### 3.2 Create .env file

```bash
nano .env
```

Copy the contents from `.env.example` and update with your values:

```env
PORT=4000
NODE_ENV=production
MONGODB_URI=your-mongodb-connection-string
CLIENT_URL=https://your-app.vercel.app
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_CALLBACK_URL=https://your-ec2-domain.com/auth/google/callback
JWT_SECRET=your-strong-jwt-secret
RAZORPAY_KEY_ID=your-razorpay-key-id
RAZORPAY_KEY_SECRET=your-razorpay-key-secret
```

**Important Notes:**
- Replace `your-ec2-domain.com` with your EC2 public IP or domain
- Replace `your-app.vercel.app` with your actual Vercel frontend URL
- For multiple frontend URLs, use comma-separated: `https://app1.vercel.app,https://app2.vercel.app`

### 3.3 Install dependencies and build

```bash
npm install
npm run build
```

### 3.4 Start with PM2

```bash
pm2 start ecosystem.config.js
pm2 save
pm2 logs typinghub-backend  # Check logs
```

## Step 4: Configure Nginx

### 4.1 Create Nginx configuration

```bash
sudo nano /etc/nginx/sites-available/typinghub-backend
```

Copy the contents from `nginx.conf` and update:
- Replace `your-domain.com` with your EC2 public IP or domain
- If using domain, update `server_name`

### 4.2 Enable the site

```bash
sudo ln -s /etc/nginx/sites-available/typinghub-backend /etc/nginx/sites-enabled/
sudo nginx -t  # Test configuration
sudo systemctl reload nginx
```

## Step 5: Update Google OAuth Settings

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Navigate to **APIs & Services** → **Credentials**
3. Edit your OAuth 2.0 Client ID
4. Add authorized redirect URI: `https://your-ec2-domain.com/auth/google/callback`
5. Save changes

## Step 6: Set Up SSL (Optional but Recommended)

### 6.1 Install Certbot

```bash
sudo apt install certbot python3-certbot-nginx -y
```

### 6.2 Get SSL Certificate

```bash
sudo certbot --nginx -d your-domain.com
```

Follow the prompts. Certbot will automatically update your Nginx configuration.

### 6.3 Update Nginx config for HTTPS

Uncomment the HTTPS server block in `/etc/nginx/sites-available/typinghub-backend` and update paths.

## Step 7: Verify Deployment

### 7.1 Check health endpoint

```bash
curl http://your-ec2-ip/health
# or
curl https://your-domain.com/health
```

Expected response:
```json
{
  "status": "healthy",
  "timestamp": "...",
  "uptime": ...,
  "database": {
    "status": "connected",
    "readyState": 1
  }
}
```

### 7.2 Check PM2 status

```bash
pm2 status
pm2 logs typinghub-backend
```

### 7.3 Test from your Vercel frontend

Update your frontend API URL to point to your EC2 instance:
- `http://your-ec2-ip` (if no domain)
- `https://your-domain.com` (if using domain with SSL)

## Step 8: Update Frontend Configuration

In your Vercel frontend, update the API base URL:

```typescript
// Example: src/config/api.ts
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://your-ec2-domain.com';
```

Add environment variable in Vercel:
- **Name**: `NEXT_PUBLIC_API_URL`
- **Value**: `https://your-ec2-domain.com` (or `http://your-ec2-ip`)

## Troubleshooting

### Check PM2 logs
```bash
pm2 logs typinghub-backend --lines 50
```

### Check Nginx logs
```bash
sudo tail -f /var/log/nginx/error.log
sudo tail -f /var/log/nginx/access.log
```

### Restart services
```bash
pm2 restart typinghub-backend
sudo systemctl restart nginx
```

### Check if port is in use
```bash
sudo netstat -tulpn | grep :4000
```

### Test MongoDB connection
```bash
node -e "require('dotenv').config(); const mongoose = require('mongoose'); mongoose.connect(process.env.MONGODB_URI).then(() => console.log('Connected')).catch(e => console.error(e))"
```

## Updating the Application

When you need to deploy updates:

```bash
cd /home/ubuntu/typinghub-backend
git pull origin main
npm install
npm run build
pm2 restart typinghub-backend
```

Or use the deployment script:
```bash
./deploy.sh
```

## Monitoring

### PM2 Monitoring
```bash
pm2 monit  # Real-time monitoring
pm2 status  # Check status
```

### Set up PM2 web dashboard (optional)
```bash
pm2 install pm2-server-monit
```

## Security Best Practices

1. **Firewall**: Only open necessary ports (80, 443)
2. **SSH**: Use key-based authentication, disable password login
3. **Updates**: Regularly update system packages
4. **Environment Variables**: Never commit `.env` file
5. **SSL**: Always use HTTPS in production
6. **Rate Limiting**: Consider adding rate limiting middleware

## Next Steps

- Set up automated backups
- Configure CloudWatch for monitoring
- Set up auto-scaling if needed
- Configure domain DNS records
- Set up CI/CD pipeline
