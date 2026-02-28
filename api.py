from flask import Flask, request, jsonify
from flask_cors import CORS
import google.generativeai as genai
from dotenv import load_dotenv
import os
import io

print("USING GEMINI BACKEND")
try:
    import PyPDF2
    PDF_SUPPORT = True
except ImportError:
    PDF_SUPPORT = False

# Load environment variables
load_dotenv()

app = Flask(__name__)
CORS(app)  # Enable CORS for React frontend

# Initialize Gemini client
gemini_api_key = os.environ.get("GEMINI_API_KEY")
if not gemini_api_key:
    raise ValueError("GEMINI_API_KEY environment variable is not set. Please create a .env file with your Gemini key.")

genai.configure(api_key=gemini_api_key)
gemini_model_name = os.environ.get("GEMINI_MODEL", "gemini-2.5-flash")

try:
    gemini_max_output_tokens = int(os.environ.get("GEMINI_MAX_OUTPUT_TOKENS", "2048"))
except ValueError:
    gemini_max_output_tokens = 2048

model = genai.GenerativeModel(gemini_model_name)
chunk_char_limit = int(os.environ.get("GEMINI_CHUNK_CHAR_LIMIT", "7000"))


def split_text_into_chunks(text: str, max_chars: int = 7000):
    if not text or len(text) <= max_chars:
        return [text]

    chunks = []
    paragraphs = text.split("\n\n")
    current_chunk = ""

    for paragraph in paragraphs:
        candidate = f"{current_chunk}\n\n{paragraph}" if current_chunk else paragraph

        if len(candidate) <= max_chars:
            current_chunk = candidate
            continue

        if current_chunk:
            chunks.append(current_chunk)
            current_chunk = ""

        if len(paragraph) <= max_chars:
            current_chunk = paragraph
            continue

        for i in range(0, len(paragraph), max_chars):
            chunks.append(paragraph[i:i + max_chars])

    if current_chunk:
        chunks.append(current_chunk)

    return [chunk for chunk in chunks if chunk]


def simplify_single_chunk(chunk_text: str):
    system_prompt = """You are a legal education assistant.
Your job is to rephrase legal documents into plain, easy-to-understand language.
- Use simple terms and short sentences.
- Explain legal terms in context.
- Keep important obligations, deadlines, and warnings intact.
- Preserve approximately the same amount of detail as the source; do not over-compress.
- Never provide definitive legal advice or claim attorney-client relationship.
- If something is unclear, say: "Consult a licensed attorney for clarification."
- End with: (Source: Educational summary, not legal advice.)"""

    response = model.generate_content(
        [system_prompt, chunk_text],
        generation_config=genai.types.GenerationConfig(
            temperature=0.2,
            max_output_tokens=gemini_max_output_tokens,
        ),
    )

    response_text = (response.text or "").strip()
    if response_text:
        return response_text

    if hasattr(response, "candidates") and response.candidates:
        parts = response.candidates[0].content.parts
        fallback_text = "".join(getattr(part, "text", "") for part in parts).strip()
        if fallback_text:
            return fallback_text

    raise Exception("Gemini returned an empty response.")

def simplify_instructions(raw_text: str):
    """
    Simplify legal documents using Gemini.
    """
    try:
        chunks = split_text_into_chunks(raw_text, chunk_char_limit)
        chunk_results = [simplify_single_chunk(chunk) for chunk in chunks]

        if len(chunk_results) == 1:
            return chunk_results[0]

        return "\n\n".join([f"Section {idx + 1}:\n{result}" for idx, result in enumerate(chunk_results)])
    except Exception as e:
        # Security: Don't expose full API key in error messages
        error_msg = str(e)
        if gemini_api_key in error_msg:
            error_msg = error_msg.replace(gemini_api_key, "***REDACTED***")
        raise Exception(f"Error calling Gemini API: {error_msg}")

@app.route('/api/simplify', methods=['POST'])
def simplify():
    """API endpoint to simplify legal documents."""
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({'success': False, 'error': 'No data provided'}), 400
        
        raw_text = data.get('text', '')
        
        if not raw_text:
            return jsonify({'success': False, 'error': 'No text provided'}), 400
        
        simplified = simplify_instructions(raw_text)
        
        return jsonify({
            'success': True,
            'result': simplified
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/upload', methods=['POST'])
def upload_file():
    """API endpoint to upload and extract text from files."""
    try:
        if 'file' not in request.files:
            return jsonify({'success': False, 'error': 'No file provided'}), 400
        
        file = request.files['file']
        
        if file.filename == '':
            return jsonify({'success': False, 'error': 'No file selected'}), 400
        
        # Check file extension
        filename = file.filename.lower()
        allowed_extensions = ['.txt', '.md', '.pdf', '.csv']
        
        if not any(filename.endswith(ext) for ext in allowed_extensions):
            return jsonify({
                'success': False,
                'error': f'File type not supported. Please upload: {", ".join(allowed_extensions)}'
            }), 400
        
        # Read file content based on type
        text_content = ''
        
        if filename.endswith('.txt') or filename.endswith('.md') or filename.endswith('.csv'):
            # Read text files directly
            try:
                # Try to decode as UTF-8
                text_content = file.read().decode('utf-8')
            except UnicodeDecodeError:
                # Try other encodings
                file.seek(0)  # Reset file pointer
                try:
                    text_content = file.read().decode('latin-1')
                except:
                    return jsonify({
                        'success': False,
                        'error': 'Unable to read file. Please ensure it is a valid text file.'
                    }), 400
        
        elif filename.endswith('.pdf'):
            # Extract text from PDF files
            if not PDF_SUPPORT:
                return jsonify({
                    'success': False,
                    'error': 'PDF support not available. Please install PyPDF2: pip install PyPDF2'
                }), 500
            
            try:
                # Read PDF file
                file.seek(0)  # Reset file pointer
                pdf_reader = PyPDF2.PdfReader(file)
                
                # Extract text from all pages
                text_content = ''
                for page_num in range(len(pdf_reader.pages)):
                    page = pdf_reader.pages[page_num]
                    text_content += page.extract_text() + '\n'
                
                if not text_content.strip():
                    return jsonify({
                        'success': False,
                        'error': 'PDF appears to be empty or contains only images. Unable to extract text.'
                    }), 400
                    
            except Exception as pdf_error:
                return jsonify({
                    'success': False,
                    'error': f'Error reading PDF file: {str(pdf_error)}'
                }), 400
        
        if not text_content.strip():
            return jsonify({
                'success': False,
                'error': 'File appears to be empty or could not be read'
            }), 400
        
        return jsonify({
            'success': True,
            'text': text_content,
            'filename': file.filename
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': f'Error processing file: {str(e)}'
        }), 500

@app.route('/api/health', methods=['GET'])
def health():
    """Health check endpoint."""
    return jsonify({'status': 'healthy'}), 200

if __name__ == '__main__':
    # Security: In production, set debug=False and use environment variables
    # debug=True should only be used in development
    debug_mode = os.environ.get("FLASK_DEBUG", "False").lower() == "true"
    app.run(debug=debug_mode, port=5000)

