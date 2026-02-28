/**
 * Cloudflare Pages Function for API endpoints
 * This handles all /api/* routes for the legal document simplifier
 * 
 * Routes:
 * - POST /api/simplify - Simplify medical instructions
 * - POST /api/upload - Upload and extract text from files
 * - GET /api/health - Health check
 */

// System prompt for Gemini
const SYSTEM_PROMPT = `You are a legal education assistant.
Your job is to rephrase legal documents into plain, easy-to-understand language.
- Use simple terms and short sentences.
- Explain legal terms in context.
- Keep important obligations, deadlines, and warnings intact.
- Preserve approximately the same amount of detail as the source; do not over-compress.
- Never provide definitive legal advice or claim attorney-client relationship.
- If something is unclear, say: "Consult a licensed attorney for clarification."
- End with: (Source: Educational summary, not legal advice.)`;

const CHUNK_CHAR_LIMIT = 7000;

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta';
const DEFAULT_MODEL_CANDIDATES = [
  'gemini-2.0-flash',
  'gemini-1.5-flash-latest',
  'gemini-1.5-pro-latest',
  'gemini-1.5-flash',
  'gemini-2.5-flash'
];

function normalizeModelName(modelName) {
  if (!modelName || typeof modelName !== 'string') {
    return null;
  }

  return modelName.trim().replace(/^models\//, '');
}

function buildModelCandidates(preferredModel) {
  const unique = new Set();
  const ordered = [preferredModel, ...DEFAULT_MODEL_CANDIDATES]
    .map(normalizeModelName)
    .filter(Boolean);

  for (const model of ordered) {
    unique.add(model);
  }

  return Array.from(unique);
}

function getMaxOutputTokens(env) {
  const configured = Number.parseInt(env?.GEMINI_MAX_OUTPUT_TOKENS, 10);

  if (!Number.isNaN(configured) && configured > 0) {
    return configured;
  }

  return 2048;
}

async function callGeminiGenerateContent(text, apiKey, model, maxOutputTokens) {
  const response = await fetch(`${GEMINI_API_BASE}/models/${model}:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      contents: [
        {
          role: 'user',
          parts: [
            { text: SYSTEM_PROMPT },
            { text },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens,
      },
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const error = new Error(errorData.error?.message || `Gemini API error: ${response.status}`);
    error.status = response.status;
    error.model = model;
    throw error;
  }

  const data = await response.json();
  const textResponse = data?.candidates?.[0]?.content?.parts?.map(part => part.text || '').join('').trim();

  if (!textResponse) {
    const error = new Error('Gemini returned an empty response');
    error.status = 502;
    error.model = model;
    throw error;
  }

  return textResponse;
}

function splitTextIntoChunks(text, maxChars = CHUNK_CHAR_LIMIT) {
  if (!text || text.length <= maxChars) {
    return [text];
  }

  const chunks = [];
  const paragraphs = text.split(/\n\s*\n/);
  let currentChunk = '';

  for (const paragraph of paragraphs) {
    const candidate = currentChunk ? `${currentChunk}\n\n${paragraph}` : paragraph;

    if (candidate.length <= maxChars) {
      currentChunk = candidate;
      continue;
    }

    if (currentChunk) {
      chunks.push(currentChunk);
      currentChunk = '';
    }

    if (paragraph.length <= maxChars) {
      currentChunk = paragraph;
      continue;
    }

    for (let index = 0; index < paragraph.length; index += maxChars) {
      chunks.push(paragraph.slice(index, index + maxChars));
    }
  }

  if (currentChunk) {
    chunks.push(currentChunk);
  }

  return chunks.filter(Boolean);
}

/**
 * Simplify legal text using Gemini
 */
async function simplifyInstructions(text, apiKey, preferredModel, maxOutputTokens) {
  try {
    const modelCandidates = buildModelCandidates(preferredModel);
    let lastError = null;

    const chunks = splitTextIntoChunks(text, CHUNK_CHAR_LIMIT);
    const chunkResults = [];

    for (const chunk of chunks) {
      let chunkResult = null;

      for (const model of modelCandidates) {
        try {
          chunkResult = await callGeminiGenerateContent(chunk, apiKey, model, maxOutputTokens);
          break;
        } catch (error) {
          lastError = error;
          if (error?.status === 404) {
            continue;
          }
          throw error;
        }
      }

      if (!chunkResult) {
        if (lastError) {
          throw lastError;
        }
        throw new Error('No Gemini model candidates available');
      }

      chunkResults.push(chunkResult);
    }

    if (chunkResults.length === 1) {
      return chunkResults[0];
    }

    return chunkResults
      .map((result, index) => `Section ${index + 1}:\n${result}`)
      .join('\n\n');
  } catch (error) {
    // Security: Don't expose API key in error messages
    let errorMsg = error.message || 'Unknown error';
    if (apiKey && errorMsg.includes(apiKey)) {
      errorMsg = errorMsg.replace(apiKey, '***REDACTED***');
    }
    throw new Error(`Error calling Gemini API: ${errorMsg}`);
  }
}

/**
 * Extract text from uploaded file
 * Note: PDF parsing is limited in Pages Functions - we'll handle text files primarily
 */
async function extractTextFromFile(file, filename) {
  const fileExtension = filename.toLowerCase().split('.').pop();
  const textExtensions = ['txt', 'md', 'csv'];
  
  if (textExtensions.includes(fileExtension)) {
    // Read text files
    const text = await file.text();
    return text;
  } else if (fileExtension === 'pdf') {
    // PDFs should be handled client-side before reaching this function
    // This is a fallback in case a PDF somehow reaches the API
    throw new Error('PDF files should be processed client-side. If you see this error, please try uploading the PDF again.');
  } else {
    throw new Error(`Unsupported file type: ${fileExtension}. Supported types: ${textExtensions.join(', ')}, pdf`);
  }
}

function inferReferralData(rawText, simplifiedText) {
  const combinedText = `${rawText}\n${simplifiedText}`.toLowerCase();

  const specialtyPatterns = [
    ['tenant rights lawyer', [/\brent\b/, /\btenant\b/, /\blease\b/, /\beviction\b/, /\blandlord\b/, /\bhousing\b/]],
    ['employment lawyer', [/\bemployment\b/, /\bworkplace\b/, /\bwage\b/, /\bovertime\b/, /\bwrongful termination\b/, /\bharassment\b/]],
    ['immigration attorney', [/\bimmigration\b/, /\bvisa\b/, /\bgreen card\b/, /\basylum\b/, /\bcitizenship\b/]],
    ['family law attorney', [/\bdivorce\b/, /\bcustody\b/, /\balimony\b/, /\bchild support\b/, /\bfamily court\b/]],
    ['criminal defense attorney', [/\bcriminal\b/, /\barrest\b/, /\bcharge\b/, /\bdui\b/, /\bfelony\b/, /\bmisdemeanor\b/]],
    ['personal injury lawyer', [/\baccident\b/, /\binjury\b/, /\bmedical bills\b/, /\bnegligence\b/]],
    ['bankruptcy attorney', [/\bbankruptcy\b/, /\bdebt\b/, /\bchapter 7\b/, /\bchapter 13\b/, /\bcollections\b/]],
    ['estate planning attorney', [/\bwill\b/, /\btrust\b/, /\bprobate\b/, /\bestate\b/, /\bpower of attorney\b/]],
    ['contract lawyer', [/\bcontract\b/, /\bagreement\b/, /\bbreach\b/, /\bterms and conditions\b/]],
  ];

  let inferredKeyword = 'legal aid clinic';
  for (const [specialty, patterns] of specialtyPatterns) {
    if (patterns.some((pattern) => pattern.test(combinedText))) {
      inferredKeyword = specialty;
      break;
    }
  }

  const mapIntentPatterns = [/\bfind\b/, /\blook\s*up\b/, /\bsearch\b/, /\bnear\s*me\b/, /\bnearby\b/, /\bmap\b/, /\bopen\b/, /\blocate\b/, /\bconnect me\b/, /\breferral\b/];
  const practitionerPatterns = [/\blawyer\b/, /\battorney\b/, /\blegal advisor\b/, /\blegal aid\b/, /\blegal clinic\b/, /\bpractitioner\b/];

  const hasMapIntent = mapIntentPatterns.some((pattern) => pattern.test(combinedText));
  const hasPractitionerIntent = practitionerPatterns.some((pattern) => pattern.test(combinedText));

  return {
    aiKeywords: inferredKeyword,
    openAdvisorsTab: hasMapIntent && hasPractitionerIntent,
  };
}

/**
 * Handle CORS headers
 */
function getCorsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

/**
 * Main Pages Function handler
 */
export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const pathname = url.pathname;

  // Handle CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      headers: getCorsHeaders(),
    });
  }

  try {
    // Health check endpoint
    if (pathname === '/api/health' && request.method === 'GET') {
      return new Response(
        JSON.stringify({ status: 'healthy' }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            ...getCorsHeaders(),
          },
        }
      );
    }

    // Simplify endpoint
    if (pathname === '/api/simplify' && request.method === 'POST') {
      const apiKey = env.GEMINI_API_KEY;
      const configuredModel = env.GEMINI_MODEL;
      const maxOutputTokens = getMaxOutputTokens(env);
      if (!apiKey) {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'GEMINI_API_KEY is not configured',
          }),
          {
            status: 500,
            headers: {
              'Content-Type': 'application/json',
              ...getCorsHeaders(),
            },
          }
        );
      }

      // Validate API key format
      if (apiKey.length < 20) {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Invalid Gemini API key format',
          }),
          {
            status: 500,
            headers: {
              'Content-Type': 'application/json',
              ...getCorsHeaders(),
            },
          }
        );
      }

      const body = await request.json();
      const text = body.text;

      if (!text || !text.trim()) {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'No text provided',
          }),
          {
            status: 400,
            headers: {
              'Content-Type': 'application/json',
              ...getCorsHeaders(),
            },
          }
        );
      }

      const simplified = await simplifyInstructions(text, apiKey, configuredModel, maxOutputTokens);
      const referralData = inferReferralData(text, simplified);

      return new Response(
        JSON.stringify({
          success: true,
          result: simplified,
          aiKeywords: referralData.aiKeywords,
          openAdvisorsTab: referralData.openAdvisorsTab,
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            ...getCorsHeaders(),
          },
        }
      );
    }

    // File upload endpoint
    if (pathname === '/api/upload' && request.method === 'POST') {
      const formData = await request.formData();
      const file = formData.get('file');

      if (!file) {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'No file provided',
          }),
          {
            status: 400,
            headers: {
              'Content-Type': 'application/json',
              ...getCorsHeaders(),
            },
          }
        );
      }

      const filename = file.name || 'unknown';
      const allowedExtensions = ['.txt', '.md', '.pdf', '.csv'];
      const fileExtension = filename.toLowerCase().substring(filename.lastIndexOf('.'));

      if (!allowedExtensions.includes(fileExtension)) {
        return new Response(
          JSON.stringify({
            success: false,
            error: `File type not supported. Please upload: ${allowedExtensions.join(', ')}`,
          }),
          {
            status: 400,
            headers: {
              'Content-Type': 'application/json',
              ...getCorsHeaders(),
            },
          }
        );
      }

      try {
        const textContent = await extractTextFromFile(file, filename);

        if (!textContent || !textContent.trim()) {
          return new Response(
            JSON.stringify({
              success: false,
              error: 'File appears to be empty or could not be read',
            }),
            {
              status: 400,
              headers: {
                'Content-Type': 'application/json',
                ...getCorsHeaders(),
              },
            }
          );
        }

        return new Response(
          JSON.stringify({
            success: true,
            text: textContent,
            filename: filename,
          }),
          {
            status: 200,
            headers: {
              'Content-Type': 'application/json',
              ...getCorsHeaders(),
            },
          }
        );
      } catch (error) {
        return new Response(
          JSON.stringify({
            success: false,
            error: error.message || 'Error processing file',
          }),
          {
            status: 400,
            headers: {
              'Content-Type': 'application/json',
              ...getCorsHeaders(),
            },
          }
        );
      }
    }

    // 404 for unknown routes
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Not found',
      }),
      {
        status: 404,
        headers: {
          'Content-Type': 'application/json',
          ...getCorsHeaders(),
        },
      }
    );
  } catch (error) {
    console.error('Pages Function error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Internal server error',
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          ...getCorsHeaders(),
        },
      }
    );
  }
}

