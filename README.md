# TypingHub Backend

Backend API for TypingHub - A typing practice application.

## Features

- User authentication with Google OAuth
- Paragraph management and submissions
- Leaderboard system
- Payment integration with Razorpay
- Health check endpoint

## Tech Stack

- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **Database**: MongoDB (MongoDB Atlas)
- **Authentication**: Passport.js with Google OAuth
- **Process Manager**: PM2
- **Reverse Proxy**: Nginx

## Getting Started

### Prerequisites

- Node.js 18 or higher
- MongoDB Atlas account (or local MongoDB)
- Google OAuth credentials
- Razorpay account (for payments)

### Local Development

1. **Clone the repository**
   ```bash
   git clone https://github.com/your-username/typinghub-backend.git
   cd typinghub-backend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Run in development mode**
   ```bash
   npm run dev
   ```

5. **Build for production**
   ```bash
   npm run build
   npm start
   ```

## Environment Variables

See `.env.example` for all required environment variables:

- `PORT` - Server port (default: 4000)
- `MONGODB_URI` - MongoDB connection string
- `CLIENT_URL` - Frontend URL (for CORS). Can be comma-separated for multiple origins.
- `GOOGLE_CLIENT_ID` - Google OAuth client ID
- `GOOGLE_CLIENT_SECRET` - Google OAuth client secret
- `GOOGLE_CALLBACK_URL` - Google OAuth callback URL
- `JWT_SECRET` - Secret key for JWT tokens
- `RAZORPAY_KEY_ID` - Razorpay key ID
- `RAZORPAY_KEY_SECRET` - Razorpay key secret

## API Endpoints

### Health Check
- `GET /health` - Health check endpoint

### Authentication
- `GET /auth/google` - Initiate Google OAuth
- `GET /auth/google/callback` - Google OAuth callback
- `GET /auth/me` - Get current user (requires auth)
- `POST /auth/logout` - Logout

### Paragraphs
- `GET /paragraphs` - List paragraphs (with filters)
- `GET /paragraphs/:id` - Get paragraph by ID
- `GET /paragraphs/:id/submissions/leaderboard` - Get leaderboard
- `GET /paragraphs/:id/submissions/history` - Get user submission history
- `POST /paragraphs/:id/submissions` - Submit typing result

### Payments
- `POST /payments/create-order` - Create Razorpay order
- `POST /payments/verify` - Verify payment

## Deployment

### Deploy to EC2

For detailed EC2 deployment instructions, see:
- **[EC2_DEPLOYMENT.md](./EC2_DEPLOYMENT.md)** - Comprehensive deployment guide
- **[QUICK_START_EC2.md](./QUICK_START_EC2.md)** - Quick reference guide

**Quick steps:**
1. Run `setup-ec2.sh` on your EC2 instance
2. Clone repository and configure `.env`
3. Build and start with PM2
4. Configure Nginx reverse proxy
5. Update Google OAuth callback URL

### Deploy Updates

```bash
# On EC2 instance
cd /path/to/typinghub-backend
git pull
npm install
npm run build
pm2 restart typinghub-backend
```

Or use the deployment script:
```bash
./deploy.sh
```

## Project Structure

```
typinghub-backend/
├── src/
│   ├── config/          # Configuration files (db, env, passport)
│   ├── middleware/      # Express middleware (auth, adminAuth)
│   ├── models/          # Mongoose models
│   ├── routes/          # API routes
│   ├── types/           # TypeScript type definitions
│   ├── utils/           # Utility functions (JWT)
│   └── index.ts         # Application entry point
├── scripts/             # Utility scripts (seed)
├── logs/                # PM2 logs (created at runtime)
├── dist/                # Compiled JavaScript (created after build)
├── .env.example         # Environment variables template
├── ecosystem.config.js  # PM2 configuration
├── nginx.conf           # Nginx configuration template
├── deploy.sh            # Deployment script
└── setup-ec2.sh         # EC2 initial setup script
```

## Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Compile TypeScript to JavaScript
- `npm start` - Start production server
- `npm run seed` - Seed database with sample data

## Health Check

The health endpoint provides server and database status:

```bash
curl http://localhost:4000/health
```

Response:
```json
{
  "status": "healthy",
  "timestamp": "2026-01-28T...",
  "uptime": 123.45,
  "database": {
    "status": "connected",
    "readyState": 1
  }
}
```

## Error Handling

The application includes comprehensive error handling:

- Global error handlers for unhandled promise rejections
- Express error middleware
- MongoDB connection error handling
- Graceful shutdown handlers

## Security

- CORS configured for specific origins
- JWT-based authentication
- HTTP-only cookies for tokens
- Environment variables for sensitive data
- Input validation on routes

## Monitoring

### PM2 Commands

```bash
pm2 status              # Check process status
pm2 logs typinghub-backend  # View logs
pm2 monit               # Real-time monitoring
pm2 restart typinghub-backend  # Restart application
```

### Nginx Logs

```bash
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

## Troubleshooting

### Common Issues

1. **Port already in use**
   ```bash
   sudo lsof -i :4000
   pm2 delete typinghub-backend
   pm2 start ecosystem.config.js
   ```

2. **CORS errors**
   - Verify `CLIENT_URL` in `.env` matches frontend URL exactly
   - Restart PM2: `pm2 restart typinghub-backend`

3. **MongoDB connection failed**
   - Verify `MONGODB_URI` is correct
   - Check MongoDB Atlas IP whitelist
   - Ensure network connectivity

4. **Google OAuth not working**
   - Verify callback URL matches exactly
   - Check Google Console redirect URIs
   - Ensure CORS allows the origin

## License

ISC

## Support

For deployment help, refer to:
- [EC2_DEPLOYMENT.md](./EC2_DEPLOYMENT.md)
- [QUICK_START_EC2.md](./QUICK_START_EC2.md)
