import { createClient } from '@supabase/supabase-js';

// Get Supabase credentials from environment variables
// Create a .env file in the root with:
// REACT_APP_SUPABASE_URL=your_supabase_url
// REACT_APP_SUPABASE_ANON_KEY=your_supabase_anon_key

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase environment variables. Please create a .env file with REACT_APP_SUPABASE_URL and REACT_APP_SUPABASE_ANON_KEY. See .env.example for reference.'
  );
}

// Security: Validate Supabase URL format
if (!supabaseUrl.startsWith('https://')) {
  console.warn('Warning: Supabase URL should start with https://');
}

// Security: Validate anon key format (Supabase anon keys are typically JWT tokens)
if (supabaseAnonKey.length < 100) {
  console.warn('Warning: Supabase anon key format may be invalid');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

