import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Upload, FileText, X, Book, MapPin } from 'lucide-react';
import API_URL from '../config/api';
import * as pdfjsLib from 'pdfjs-dist';
import './Search.css';

// Configure pdf.js worker - use unpkg CDN for better reliability
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.js`;

const Search = () => {
  const [medicalText, setMedicalText] = useState('');
  const [result, setResult] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [uploadedFile, setUploadedFile] = useState(null);
  const [fileName, setFileName] = useState('');
  const fileInputRef = useRef(null);
  const { userEmail, logout } = useAuth();
  const [aiKeyword, setAiKeyword] = useState('');
  const navigate = useNavigate();

  const exampleQueries = [
    'What does this lease agreement clause mean?',
    'Can you simplify this employment contract?',
    'What are my rights in this eviction notice?',
    'What should I know before signing this legal document?'
  ];

  const readJsonResponse = async (response) => {
    const responseText = await response.text();

    if (!responseText || !responseText.trim()) {
      return {};
    }

    try {
      return JSON.parse(responseText);
    } catch {
      throw new Error(`Server returned an invalid response (status ${response.status})`);
    }
  };

  /**
   * Extract text from PDF file using pdf.js
   */
  const extractTextFromPDF = async (file) => {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      let fullText = '';

      // Extract text from all pages
      for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        const page = await pdf.getPage(pageNum);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map(item => item.str).join(' ');
        fullText += pageText + '\n';
      }

      return fullText.trim();
    } catch (error) {
      console.error('Error extracting PDF text:', error);
      throw new Error(`Failed to extract text from PDF: ${error.message}`);
    }
  };


  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Check file type
    const allowedTypes = ['text/plain', 'text/markdown', 'application/pdf', 'text/csv'];
    const isPDF = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
    const isTextFile = allowedTypes.includes(file.type) || 
                      file.name.endsWith('.txt') || 
                      file.name.endsWith('.md') || 
                      file.name.endsWith('.csv');

    if (!isTextFile && !isPDF) {
      alert('Please upload a text file (.txt, .md, .csv) or PDF (.pdf)');
      return;
    }

    setFileName(file.name);
    setIsLoading(true);

    try {
      let textContent = '';

      if (isPDF) {
        // Extract text from PDF client-side
        textContent = await extractTextFromPDF(file);
        
        if (!textContent || !textContent.trim()) {
          throw new Error('PDF appears to be empty or contains only images. Unable to extract text.');
        }

        // Set the extracted text and auto-submit
        setUploadedFile(file);
        setMedicalText(textContent);
        await simplifyText(textContent, true);
      } else {
        // For text files, use the upload API
        const formData = new FormData();
        formData.append('file', file);

        const response = await fetch(`${API_URL}/api/upload`, {
          method: 'POST',
          body: formData,
        });

        const data = await readJsonResponse(response);

        if (!response.ok) {
          throw new Error(data.error || 'Failed to process file');
        }

        if (data.success) {
          setUploadedFile(file);
          setMedicalText(data.text || '');
          // Auto-submit if text was extracted
          if (data.text) {
            await simplifyText(data.text, true);
          }
        } else {
          throw new Error(data.error || 'Unknown error occurred');
        }
      }
    } catch (error) {
      console.error('Error:', error);
      if (error?.message?.includes('Failed to fetch')) {
        alert('Cannot reach API server. Start backend with: npm run dev:api');
      } else {
        alert(`Failed to process file: ${error.message}`);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const simplifyText = async (text) => {
    setIsLoading(true);
    setShowResults(false);
  
    try {
      const response = await fetch(`${API_URL}/api/simplify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
  
      const data = await readJsonResponse(response);
  
      if (!response.ok) {
        throw new Error(data.error || 'Failed to simplify document');
      }
  
      if (data.success) {
        setResult(data.result);
        setShowResults(true);

        // Extract AI lawyer keyword and trigger map search
        if (data.aiKeywords) {
          setAiKeyword(data.aiKeywords);           // store AI keyword
          // map component (LawyerMap) will watch `aiKeyword` and perform the
          // places lookup automatically once it has loaded.
        }
      } else {
        throw new Error(data.error || 'Unknown error occurred');
      }
    } catch (error) {
      console.error('Error:', error);
      if (error?.message?.includes('Failed to fetch')) {
        alert('Cannot reach API server. Start backend with: npm run dev:api');
      } else {
        alert(`Failed to simplify document: ${error.message}`);
      }
    } finally {
      setIsLoading(false);
    }
  };


  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!medicalText.trim()) {
      alert('Please enter a legal document or instructions to simplify, or upload a file');
      return;
    }

    await simplifyText(medicalText);
  };

  const handleRemoveFile = () => {
    setUploadedFile(null);
    setFileName('');
    setMedicalText('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleClear = () => {
    setMedicalText('');
    setResult('');
    setShowResults(false);
    handleRemoveFile();
    setAiKeyword('');
  };

  const handleExampleClick = (example) => {
    setMedicalText(example);
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="search-page">
      <nav className="navbar">
        <div className="nav-container">
          <div className="nav-logo">
            <button
              type="button"
              className="nav-logo-link"
              onClick={() => navigate('/home')}
              aria-label="Go to home page"
            >
              <img src="/images/afro-pix-logo.png" alt="Compass logo" className="nav-logo-image" />
              <h2>Compass</h2>
            </button>
          </div>
          <div className="nav-user">
            <button
              className="dictionary-btn"
              onClick={() => navigate('/home')}
            >
              Home
            </button>
            <button 
              className="dictionary-btn" 
              onClick={() => navigate('/dictionary')}
            >
              <Book size={16} />
              Legal Glossary
            </button>
            <button
              className="dictionary-btn"
              onClick={() => navigate('/advisors', { state: { aiKeyword } })}
            >
              <MapPin size={16} />
              Legal Advisors
            </button>
            <span>{userEmail}</span>
            <button className="btn btn-secondary" onClick={handleLogout}>
              Logout
            </button>
          </div>
        </div>
      </nav>
      
      <div className="container">
        <div className="search-section">
          <h1>Simplify Legal Documents</h1>
          <p className="subtitle">
            Paste legal text or upload a legal document to get a clear, plain-language explanation
          </p>
          
          <div className="search-container">
            {/* File Upload Section */}
            <div className="file-upload-section">
              <div className="file-upload-area">
                <input
                  ref={fileInputRef}
                  type="file"
                  id="file-upload"
                  onChange={handleFileUpload}
                  accept=".txt,.md,.pdf,.csv,text/plain,text/markdown,application/pdf,text/csv"
                  className="file-input"
                  disabled={isLoading}
                />
                <label htmlFor="file-upload" className="file-upload-label">
                  <Upload className="upload-icon" size={24} />
                  <span>Upload Legal Document</span>
                  <span className="file-types">(.txt, .md, .pdf)</span>
                </label>
              </div>
              {uploadedFile && (
                <div className="uploaded-file-info">
                  <FileText className="file-icon" size={20} />
                  <span className="file-name">{fileName}</span>
                  <button
                    type="button"
                    onClick={handleRemoveFile}
                    className="remove-file-btn"
                    disabled={isLoading}
                  >
                    <X size={16} />
                  </button>
                </div>
              )}
            </div>

            <div className="divider">
              <span>OR</span>
            </div>

            <form onSubmit={handleSubmit} className="search-form">
              <div className="input-group">
                <textarea
                  value={medicalText}
                  onChange={(e) => setMedicalText(e.target.value)}
                  className="search-input"
                  placeholder="Enter contract text, policy language, notices, or legal terms here..."
                  rows="6"
                  required
                />
              </div>
              
              <button type="submit" className="btn btn-primary btn-large" disabled={isLoading}>
                {isLoading ? (
                  <span className="spinner">⏳ Processing...</span>
                ) : (
                  'Ask Jarvis'
                )}
              </button>
            </form>
          </div>
          
          {showResults && (
            <div className="results-container">
              <h2>Simplified Legal Summary</h2>
              <div className="result-content">{result}</div>
              <div className="results-actions">
                <button
                  className="btn btn-primary"
                  onClick={() => navigate('/advisors', { state: { aiKeyword } })}
                >
                  <MapPin size={16} />
                  Find Nearby Legal Advisors
                </button>
              </div>
              <button className="btn btn-secondary" onClick={handleClear}>
                Clear Results
              </button>
            </div>
          )}
          
          <div className="examples-section">
            <h3>Example Queries</h3>
            <div className="examples-grid">
              {exampleQueries.map((example, index) => (
                <button
                  key={index}
                  className="example-btn"
                  onClick={() => handleExampleClick(example)}
                >
                  {example}
                </button>
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default Search;

