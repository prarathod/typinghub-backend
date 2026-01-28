#!/bin/bash

# EC2 Initial Setup Script for TypingHub Backend
# Run this script on a fresh Ubuntu EC2 instance
# Usage: chmod +x setup-ec2.sh && ./setup-ec2.sh

set -e

echo "🚀 Starting EC2 setup for TypingHub Backend..."

# Update system
echo "📦 Updating system packages..."
sudo apt update && sudo apt upgrade -y

# Install Node.js 18.x
echo "📦 Installing Node.js..."
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
    sudo apt-get install -y nodejs
else
    echo "✅ Node.js already installed: $(node --version)"
fi

# Install PM2
echo "📦 Installing PM2..."
if ! command -v pm2 &> /dev/null; then
    sudo npm install -g pm2
    echo "✅ PM2 installed"
else
    echo "✅ PM2 already installed: $(pm2 --version)"
fi

# Setup PM2 startup
echo "🔧 Setting up PM2 startup..."
pm2 startup | grep -v "PM2" | sudo bash || echo "PM2 startup already configured"

# Install Nginx
echo "📦 Installing Nginx..."
if ! command -v nginx &> /dev/null; then
    sudo apt install nginx -y
    sudo systemctl enable nginx
    sudo systemctl start nginx
    echo "✅ Nginx installed and started"
else
    echo "✅ Nginx already installed"
fi

# Install Git
echo "📦 Installing Git..."
if ! command -v git &> /dev/null; then
    sudo apt install git -y
    echo "✅ Git installed"
else
    echo "✅ Git already installed: $(git --version)"
fi

# Create logs directory
echo "📁 Creating logs directory..."
mkdir -p logs

# Create app directory structure
echo "📁 Setting up directory structure..."
mkdir -p /home/ubuntu/apps
cd /home/ubuntu/apps

echo ""
echo "✅ EC2 setup completed!"
echo ""
echo "📝 Next steps:"
echo "1. Clone your repository:"
echo "   cd /home/ubuntu/apps"
echo "   git clone https://github.com/your-username/typinghub-backend.git"
echo "   cd typinghub-backend"
echo ""
echo "2. Create .env file:"
echo "   cp .env.example .env"
echo "   nano .env  # Edit with your values"
echo ""
echo "3. Install dependencies and build:"
echo "   npm install"
echo "   npm run build"
echo ""
echo "4. Start with PM2:"
echo "   pm2 start ecosystem.config.js"
echo "   pm2 save"
echo ""
echo "5. Configure Nginx (see EC2_DEPLOYMENT.md)"
echo ""
echo "6. Update security groups in AWS Console:"
echo "   - Allow HTTP (port 80)"
echo "   - Allow HTTPS (port 443)"
echo ""
