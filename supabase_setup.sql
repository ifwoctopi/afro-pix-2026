-- Supabase Database Setup
-- Run this SQL in your Supabase SQL Editor

-- Create searches table
CREATE TABLE IF NOT EXISTS searches (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  query TEXT NOT NULL,
  result TEXT NOT NULL,
  file_uploaded BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Create index on user_id for faster queries
CREATE INDEX IF NOT EXISTS searches_user_id_idx ON searches(user_id);

-- Create index on created_at for sorting
CREATE INDEX IF NOT EXISTS searches_created_at_idx ON searches(created_at DESC);

-- Enable Row Level Security (RLS) for searches
ALTER TABLE searches ENABLE ROW LEVEL SECURITY;

-- Create policy: Users can only see their own searches
CREATE POLICY "Users can view their own searches"
  ON searches
  FOR SELECT
  USING (auth.uid() = user_id);

-- Create policy: Users can insert their own searches
CREATE POLICY "Users can insert their own searches"
  ON searches
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Create policy: Users can delete their own searches
CREATE POLICY "Users can delete their own searches"
  ON searches
  FOR DELETE
  USING (auth.uid() = user_id);

-- Create dictionary table for medical terms
CREATE TABLE IF NOT EXISTS dictionary (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  medical_term TEXT NOT NULL UNIQUE,
  definition TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Create index on medical_term for faster searching (case-insensitive)
CREATE INDEX IF NOT EXISTS dictionary_medical_term_idx ON dictionary(LOWER(medical_term));

-- Create full-text search index for better search performance
CREATE INDEX IF NOT EXISTS dictionary_term_definition_fts_idx ON dictionary 
  USING gin(to_tsvector('english', medical_term || ' ' || definition));

-- Enable Row Level Security (RLS) for dictionary
ALTER TABLE dictionary ENABLE ROW LEVEL SECURITY;

-- Create policy: All authenticated users can read/search the dictionary
CREATE POLICY "Authenticated users can read dictionary"
  ON dictionary
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- Optional: Create a function to automatically clean up old searches (older than 90 days)
CREATE OR REPLACE FUNCTION delete_old_searches()
RETURNS void AS $$
BEGIN
  DELETE FROM searches
  WHERE created_at < NOW() - INTERVAL '90 days';
END;
$$ LANGUAGE plpgsql;

-- Create function to search dictionary (case-insensitive, partial match)
CREATE OR REPLACE FUNCTION search_dictionary(search_term TEXT)
RETURNS TABLE (
  id UUID,
  medical_term TEXT,
  definition TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    d.id,
    d.medical_term,
    d.definition
  FROM dictionary d
  WHERE 
    LOWER(d.medical_term) LIKE '%' || LOWER(search_term) || '%'
    OR LOWER(d.definition) LIKE '%' || LOWER(search_term) || '%'
  ORDER BY 
    CASE 
      WHEN LOWER(d.medical_term) = LOWER(search_term) THEN 1
      WHEN LOWER(d.medical_term) LIKE LOWER(search_term) || '%' THEN 2
      ELSE 3
    END,
    d.medical_term
  LIMIT 50;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function for full-text search (better performance for complex searches)
CREATE OR REPLACE FUNCTION search_dictionary_fts(search_term TEXT)
RETURNS TABLE (
  id UUID,
  medical_term TEXT,
  definition TEXT,
  rank REAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    d.id,
    d.medical_term,
    d.definition,
    ts_rank(to_tsvector('english', d.medical_term || ' ' || d.definition), 
            plainto_tsquery('english', search_term)) AS rank
  FROM dictionary d
  WHERE 
    to_tsvector('english', d.medical_term || ' ' || d.definition) @@ 
    plainto_tsquery('english', search_term)
  ORDER BY rank DESC
  LIMIT 50;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions on search functions to authenticated users
GRANT EXECUTE ON FUNCTION search_dictionary(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION search_dictionary_fts(TEXT) TO authenticated;

