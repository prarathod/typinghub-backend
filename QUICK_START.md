# Quick Start - EC2 Deployment

## TL;DR - Deploy in 5 Minutes

```bash
# 1. SSH into your EC2 instance
ssh -i your-key.pem ubuntu@your-ec2-ip

# 2. Install Node.js and PM2
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
sudo npm install -g pm2

# 3. Clone and setup
git clone https://github.com/your-username/typinghub-backend.git
cd typinghub-backend
nano .env  # Add your environment variables

# 4. Deploy
npm install
npm run build
pm2 start ecosystem.config.js
pm2 save
pm2 startup  # Follow instructions

# 5. Update Vercel frontend
# Add environment variable: VITE_API_BASE_URL=http://your-ec2-ip:4000
```

## Environment Variables Template

```env
NODE_ENV=production
PORT=4000
MONGODB_URI=your_mongodb_uri
CLIENT_URL=https://your-vercel-app.vercel.app
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_CALLBACK_URL=http://your-ec2-ip:4000/auth/google/callback
JWT_SECRET=your_jwt_secret
RAZORPAY_KEY_ID=your_razorpay_key_id
RAZORPAY_KEY_SECRET=your_razorpay_key_secret
```

## After Code Updates

```bash
cd ~/typinghub-backend
git pull
./deploy.sh
```

## Check Status

```bash
pm2 status
pm2 logs typinghub-backend
curl http://localhost:4000/health
```

For detailed instructions, see [DEPLOYMENT.md](./DEPLOYMENT.md)
