/**
 * API Configuration
 * Uses environment variable for API URL, falls back to localhost for development
 * 
 * For Cloudflare Pages deployment:
 * - If REACT_APP_API_URL is not set, use relative URLs (same domain) in production
 * - This allows the Pages Functions to handle the API routes
 * - For local development, use localhost:5000
 */

// If deployed on Cloudflare Pages, use relative URLs (same origin)
// For local development, use localhost.

const API_URL = process.env.NODE_ENV === 'production' 
  ? '/api'  // In Cloudflare, this hits your /functions/api folder
  : 'http://localhost:5000'; // Local development

export default API_URL;

