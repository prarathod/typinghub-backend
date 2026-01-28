# AWS EC2 Deployment Guide for TypingHub Backend

This guide will help you deploy the TypingHub backend to AWS EC2 and connect it with your Vercel frontend.

## Prerequisites

- AWS Account
- EC2 Instance (Ubuntu 22.04 LTS recommended)
- Domain name (optional, but recommended)
- MongoDB Atlas connection string (already configured)

## Step 1: Launch EC2 Instance

1. Go to AWS Console → EC2 → Launch Instance
2. Choose **Ubuntu Server 22.04 LTS**
3. Select instance type: **t2.micro** (free tier) or **t3.small** (recommended)
4. Configure Security Group:
   - **SSH (22)**: Your IP only
   - **HTTP (80)**: 0.0.0.0/0 (all IPs)
   - **HTTPS (443)**: 0.0.0.0/0 (all IPs)
   - **Custom TCP (4000)**: 0.0.0.0/0 (for direct backend access, optional)
5. Create/select a key pair and download it
6. Launch instance

## Step 2: Connect to EC2 Instance

```bash
# Make key file executable
chmod 400 your-key.pem

# Connect to instance
ssh -i your-key.pem ubuntu@your-ec2-public-ip
```

## Step 3: Initial Server Setup

```bash
# Update system packages
sudo apt update && sudo apt upgrade -y

# Install Node.js 20.x
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Verify installation
node --version
npm --version

# Install PM2 globally (process manager)
sudo npm install -g pm2

# Install Git
sudo apt install git -y

# Install Nginx (optional, for reverse proxy)
sudo apt install nginx -y
```

## Step 4: Clone and Setup Backend

```bash
# Navigate to home directory
cd ~

# Clone your repository
git clone https://github.com/your-username/typinghub-backend.git
cd typinghub-backend

# Create .env file
nano .env
```

Add the following to `.env` (replace with your actual values):

```env
NODE_ENV=production
PORT=4000
MONGODB_URI=your_mongodb_connection_string
CLIENT_URL=https://your-vercel-app.vercel.app,http://localhost:5173
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_CALLBACK_URL=http://your-ec2-ip-or-domain:4000/auth/google/callback
JWT_SECRET=your_jwt_secret
RAZORPAY_KEY_ID=your_razorpay_key_id
RAZORPAY_KEY_SECRET=your_razorpay_key_secret
```

**Important Notes:**
- `CLIENT_URL` should include your Vercel frontend URL (comma-separated if multiple)
- `GOOGLE_CALLBACK_URL` should point to your EC2 instance (use domain if you have one)
- Save and exit: `Ctrl+X`, then `Y`, then `Enter`

## Step 5: Build and Deploy

```bash
# Install dependencies
npm install

# Build the project
npm run build

# Create logs directory
mkdir -p logs

# Start with PM2
pm2 start ecosystem.config.js

# Save PM2 configuration to auto-start on reboot
pm2 save

# Setup PM2 to start on system boot
pm2 startup
# Follow the instructions it provides (usually run a sudo command)
```

## Step 6: Configure Nginx (Optional but Recommended)

```bash
# Copy nginx config
sudo cp nginx.conf /etc/nginx/sites-available/typinghub-backend

# Edit the config to match your domain/IP
sudo nano /etc/nginx/sites-available/typinghub-backend
# Replace "your-domain.com" with your EC2 public IP or domain

# Create symlink
sudo ln -s /etc/nginx/sites-available/typinghub-backend /etc/nginx/sites-enabled/

# Remove default nginx config
sudo rm /etc/nginx/sites-enabled/default

# Test nginx configuration
sudo nginx -t

# Start and enable nginx
sudo systemctl start nginx
sudo systemctl enable nginx
```

## Step 7: Update Google OAuth Settings

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Navigate to APIs & Services → Credentials
3. Edit your OAuth 2.0 Client ID
4. Add authorized redirect URI: `http://your-ec2-ip-or-domain:4000/auth/google/callback`
5. Save changes

## Step 8: Update Vercel Frontend

1. Go to your Vercel project settings
2. Navigate to **Environment Variables**
3. Add/Update:
   ```
   VITE_API_BASE_URL=http://your-ec2-ip-or-domain:4000
   ```
   Or if using Nginx:
   ```
   VITE_API_BASE_URL=http://your-ec2-ip-or-domain
   ```
4. Redeploy your frontend

Alternatively, update `.env` in your frontend repo and push:

```env
VITE_API_BASE_URL=http://your-ec2-ip-or-domain:4000
```

## Step 9: Test Deployment

```bash
# Check PM2 status
pm2 status

# View logs
pm2 logs typinghub-backend

# Test health endpoint
curl http://localhost:4000/health
```

From your local machine:
```bash
curl http://your-ec2-ip:4000/health
```

## Step 10: Setup SSL Certificate (Optional but Recommended)

For production, you should use HTTPS:

```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx -y

# Get SSL certificate (replace with your domain)
sudo certbot --nginx -d your-domain.com

# Certbot will automatically configure nginx and renew certificates
```

After SSL setup:
1. Update `GOOGLE_CALLBACK_URL` in `.env` to use `https://`
2. Update `CLIENT_URL` in `.env` to use your Vercel HTTPS URL
3. Update frontend `VITE_API_BASE_URL` to use `https://`
4. Restart backend: `pm2 restart typinghub-backend`

## Useful Commands

```bash
# View PM2 logs
pm2 logs typinghub-backend

# Restart application
pm2 restart typinghub-backend

# Stop application
pm2 stop typinghub-backend

# View PM2 status
pm2 status

# Monitor resources
pm2 monit

# After code updates
cd ~/typinghub-backend
git pull
./deploy.sh  # Make sure deploy.sh is executable: chmod +x deploy.sh
```

## Troubleshooting

### Backend not accessible from outside
- Check Security Group rules (ports 4000, 80, 443)
- Check if PM2 is running: `pm2 status`
- Check logs: `pm2 logs typinghub-backend`
- Verify server is listening: `sudo netstat -tlnp | grep 4000`

### CORS errors
- Verify `CLIENT_URL` in `.env` includes your Vercel URL
- Check browser console for exact CORS error
- Ensure frontend is using correct `VITE_API_BASE_URL`

### MongoDB connection issues
- Verify MongoDB Atlas allows connections from EC2 IP
- Check MongoDB connection string in `.env`
- View backend logs: `pm2 logs typinghub-backend`

### PM2 not starting on reboot
```bash
pm2 startup
# Run the command it outputs
pm2 save
```

## Security Best Practices

1. **Firewall**: Use AWS Security Groups to restrict access
2. **SSH**: Disable password authentication, use key pairs only
3. **Environment Variables**: Never commit `.env` file
4. **Regular Updates**: Keep system packages updated
5. **SSL**: Always use HTTPS in production
6. **PM2**: Monitor logs regularly for errors

## Next Steps

- Set up automated deployments with GitHub Actions
- Configure CloudWatch for monitoring
- Set up automated backups
- Configure domain name with Route 53
- Set up CDN with CloudFront (optional)
