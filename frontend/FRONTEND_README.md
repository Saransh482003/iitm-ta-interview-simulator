# Frontend Configuration Guide

## CORS Issue Resolution

The frontend has been updated to handle CORS issues properly by removing the static export configuration that was causing problems.

## Development vs Production Setup

### Development Mode (Recommended)
```bash
# Start frontend in development mode
npm run dev
```

**What happens:**
- Next.js runs on `http://localhost:3000`
- API calls are proxied to `https://cbbd10e84072.ngrok-free.app` (Flask backend)
- No CORS issues since requests go through Next.js proxy
- Full Next.js features available

### Production Mode (Static Export)
```bash
# Build for static deployment
npm run build:static
```

**What happens:**
- Creates static files in `out/` directory
- Direct API calls to backend (ngrok URL)
- Requires proper CORS setup on backend
- Suitable for static hosting (Vercel, Netlify, etc.)

## API Configuration

The app automatically detects the environment:

- **Development**: Uses Next.js proxy (`/api/*` → `https://cbbd10e84072.ngrok-free.app/api/*`)
- **Production**: Uses direct backend URL (ngrok or deployed backend)

## Environment Variables

Create `.env.local` file:
```env
NEXT_PUBLIC_BACKEND_URL=https://your-ngrok-url.ngrok-free.app
```

## How to Run

1. **Start Backend First:**
   ```bash
   cd backend
   python app.py
   ```

2. **Start Frontend:**
   ```bash
   cd frontend
   npm run dev
   ```

3. **Access Application:**
   - Frontend: `http://localhost:3000`
   - Backend: `https://cbbd10e84072.ngrok-free.app`

## Troubleshooting CORS

If you still see CORS errors:

1. **Check Backend Status**: Ensure Flask server is running
2. **Verify Proxy**: Check Next.js console for proxy errors
3. **Browser Cache**: Clear browser cache and try incognito mode
4. **Network**: Check if ports 3000 and 5000 are accessible

The new configuration should eliminate CORS issues in development mode!