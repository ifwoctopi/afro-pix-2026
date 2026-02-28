import { supabase } from '../config/supabase';

const normalizeDictionaryRows = (rows = []) => {
  return rows.map((row) => ({
    id: row.id,
    term: row.term,
    medical_term: row.term,
    definition: row.definition,
    why_matters: row.why_matters || null,
  }));
};

/**
 * Search the medical dictionary for terms
 * @param {string} searchTerm - The term to search for
 * @param {boolean} useFullTextSearch - Use full-text search (default: false)
 * @returns {Promise<{data: Array, error: Error|null}>}
 */
export const searchDictionary = async (searchTerm, useFullTextSearch = false) => {
  try {
    if (!searchTerm || searchTerm.trim() === '') {
      return { data: [], error: null };
    }

    const cleanedSearchTerm = searchTerm.trim();

    const { data, error } = await supabase
      .from('dictionary')
      .select('id, term, definition')
      .or(`term.ilike.%${cleanedSearchTerm}%,definition.ilike.%${cleanedSearchTerm}%`)
      .order('term', { ascending: true })
      .limit(50);

    if (error) throw error;
    return { data: normalizeDictionaryRows(data || []), error: null };
  } catch (error) {
    console.error('Error searching dictionary:', error);
    return { data: null, error };
  }
};

/**
 * Get a specific term from the dictionary
 * @param {string} term - The exact medical term
 * @returns {Promise<{data: Object|null, error: Error|null}>}
 */
export const getDictionaryTerm = async (term) => {
  try {
    const { data, error } = await supabase
      .from('dictionary')
      .select('id, term, definition')
      .ilike('term', term)
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') throw error; // PGRST116 = no rows returned
    return {
      data: data ? normalizeDictionaryRows([data])[0] : null,
      error: null,
    };
  } catch (error) {
    console.error('Error getting dictionary term:', error);
    return { data: null, error };
  }
};

/**
 * Get all dictionary terms (with pagination)
 * @param {number} limit - Number of terms to return
 * @param {number} offset - Offset for pagination
 * @returns {Promise<{data: Array, error: Error|null}>}
 */
export const getAllDictionaryTerms = async (limit = 1000, offset = 0) => {
  try {
    const { data, error } = await supabase
      .from('dictionary')
      .select('id, term, definition')
      .order('term', { ascending: true })
      .range(offset, offset + limit - 1);

    if (error) throw error;
    return { data: normalizeDictionaryRows(data || []), error: null };
  } catch (error) {
    console.error('Error getting dictionary terms:', error);
    return { data: null, error };
  }
};



