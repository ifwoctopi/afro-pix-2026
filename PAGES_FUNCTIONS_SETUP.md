# Cloudflare Pages Functions Setup

This guide explains how to set up the API using Cloudflare Pages Functions (not Workers). Pages Functions are automatically deployed with your Pages site, so no separate deployment is needed.

## Overview

The API endpoints are handled by Cloudflare Pages Functions located in the `functions/api/` directory:

- `/api/simplify` - Simplifies medical instructions using OpenAI
- `/api/upload` - Handles file uploads (text files)
- `/api/health` - Health check endpoint

## Setup Steps

### 1. Add OpenAI API Key to Cloudflare Pages

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. Navigate to **Pages** → Your project (`medi-chat`)
3. Go to **Settings** → **Environment variables**
4. Click **Add variable**
5. Add:
   - **Variable name**: `OPENAI_API_KEY`
   - **Value**: Your OpenAI API key (starts with `sk-`)
   - **Environment**: Select **Production** (and **Preview** if you want it for preview deployments)
6. Click **Save**

### 2. Deploy Your Site

The Pages Function will automatically be included when you deploy your Pages site. You can deploy via:

**Option A: Git Integration (Recommended)**

- Push your changes to your Git repository
- Cloudflare Pages will automatically build and deploy

**Option B: Manual Deployment**

```bash
npm run build
npx wrangler pages deploy build --project-name=medi-chat
```

### 3. Test the API

Once deployed, test the health endpoint:

```
https://your-site.pages.dev/api/health
```

You should see:

```json
{ "status": "healthy" }
```

## How It Works

### Pages Functions

Pages Functions are serverless functions that run on Cloudflare's edge network. They're automatically deployed with your Pages site and handle requests to specific routes.

- **Location**: `functions/api/[[path]].js`
- **Routes**: Handles all `/api/*` routes
- **Environment Variables**: Accessed via `env.OPENAI_API_KEY`

### Frontend Configuration

The frontend is configured to use relative URLs in production:

- **Production**: Uses relative URLs (e.g., `/api/simplify`) which are handled by Pages Functions
- **Development**: Uses `http://localhost:5000` for local Flask development

This is handled in `src/config/api.js`:

```javascript
const API_URL =
  process.env.REACT_APP_API_URL !== undefined
    ? process.env.REACT_APP_API_URL
    : process.env.NODE_ENV === "production"
    ? ""
    : "http://localhost:5000";
```

## API Endpoints

### POST `/api/simplify`

Simplifies medical instructions using OpenAI.

**Request:**

```json
{
  "text": "How do I put in my insulin pump?"
}
```

**Response:**

```json
{
  "success": true,
  "result": "Simplified instructions here..."
}
```

### POST `/api/upload`

Upload and extract text from files.

**Request:** FormData with `file` field

**Response:**

```json
{
  "success": true,
  "text": "File content here...",
  "filename": "document.txt"
}
```

### GET `/api/health`

Health check endpoint.

**Response:**

```json
{
  "status": "healthy"
}
```

## Limitations

### PDF Support

PDF parsing is **not supported** in Pages Functions due to limitations in the Cloudflare runtime. Users will need to:

- Convert PDFs to text files (.txt) first
- Or use a PDF-to-text conversion service

### File Size Limits

Cloudflare Pages Functions have limits on:

- Request size: 100MB
- Response size: 100MB
- Memory: 128MB

For most medical documents, this should be sufficient.

## Local Development

For local development, you can still use the Flask API:

1. Start the Flask server:

   ```bash
   python api.py
   ```

2. The frontend will automatically use `http://localhost:5000` when `NODE_ENV` is not `production`.

3. To test Pages Functions locally, use Wrangler:
   ```bash
   npx wrangler pages dev build
   ```

## Troubleshooting

### API Returns 500 Errors

- Verify `OPENAI_API_KEY` is set in Cloudflare Pages environment variables
- Check Pages Function logs in Cloudflare Dashboard → Pages → Your project → Functions → Logs
- Verify API key format (should start with `sk-`)

### CORS Errors

The Pages Function includes CORS headers automatically. If you see CORS errors:

- Check that the frontend is making requests to the correct domain
- Verify the Pages Function is deployed correctly
- Check browser console for specific error messages

### File Upload Not Working

- Verify file size is under 100MB
- Check that file type is supported (.txt, .md, .csv)
- PDF files are not supported - convert to text first

### Environment Variables Not Working

- Make sure you set the environment variable in the Cloudflare Pages dashboard
- Redeploy your site after adding environment variables
- Check that you selected the correct environment (Production/Preview)

## Advantages of Pages Functions

1. **No Separate Deployment**: Functions deploy automatically with your Pages site
2. **Edge Network**: Functions run on Cloudflare's global edge network for low latency
3. **Automatic Scaling**: Functions scale automatically with traffic
4. **Free Tier**: Includes generous free tier for most use cases
5. **Integrated**: Functions are part of your Pages project, making management easier

## Cost Considerations

- **Cloudflare Pages**: Free tier includes unlimited requests for Pages Functions
- **OpenAI API**: Pay per use based on tokens
- Monitor usage in Cloudflare Dashboard → Pages → Your project → Analytics

## Security

- API keys are stored as environment variables (not in code)
- CORS is enabled for cross-origin requests
- API key validation is performed
- Error messages don't expose sensitive information

## Next Steps

1. Set `OPENAI_API_KEY` in Cloudflare Pages environment variables
2. Deploy your site (via Git or manually)
3. Test the API endpoints
4. Verify the frontend is working correctly
