import React, { useState, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { MapPin, Search, Book } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import LawyerMap from '../LawyerMap';
import './Advisors.css';

const Advisors = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { userEmail, logout } = useAuth();

  const aiKeyword = location.state?.aiKeyword || '';
  const initialKeyword = useMemo(() => aiKeyword || 'legal aid clinic', [aiKeyword]);

  const [keywordInput, setKeywordInput] = useState(initialKeyword);
  const [activeKeyword, setActiveKeyword] = useState(initialKeyword);
  const [searchNonce, setSearchNonce] = useState(0);

  const handleSearch = (e) => {
    e.preventDefault();
    const normalizedKeyword = keywordInput.trim() || 'legal aid clinic';
    setActiveKeyword(normalizedKeyword);
    setSearchNonce((current) => current + 1);
  };

  const handleUseAIKeyword = () => {
    if (!aiKeyword) return;
    setKeywordInput(aiKeyword);
    setActiveKeyword(aiKeyword);
    setSearchNonce((current) => current + 1);
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="advisors-page">
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
            <button className="nav-tab-btn" onClick={() => navigate('/home')}>
              Home
            </button>
            <button className="nav-tab-btn" onClick={() => navigate('/search')}>
              AI Legal Assistant
            </button>
            <button className="nav-tab-btn" onClick={() => navigate('/dictionary')}>
              <Book size={16} />
              Legal Glossary
            </button>
            <span>{userEmail}</span>
            <button className="btn btn-secondary" onClick={handleLogout}>
              Logout
            </button>
          </div>
        </div>
      </nav>

      <div className="container">
        <div className="advisors-section">
          <h1>Find Legal Advisors Nearby</h1>
          <p className="subtitle">
            Search for lawyers or legal clinics near your location, or use AI-referral keywords from your document summary.
          </p>

          <form className="advisor-search-form" onSubmit={handleSearch}>
            <div className="advisor-input-wrap">
              <Search size={18} className="advisor-input-icon" />
              <input
                value={keywordInput}
                onChange={(e) => setKeywordInput(e.target.value)}
                placeholder="Try: tenant rights lawyer, immigration legal clinic, employment attorney"
                className="advisor-input"
              />
            </div>
            <button type="submit" className="btn btn-primary">Search Nearby</button>
            {aiKeyword && (
              <button type="button" className="btn btn-secondary" onClick={handleUseAIKeyword}>
                <MapPin size={16} />
                Use AI Referral
              </button>
            )}
          </form>

          <div className="advisors-map-shell">
            <h3>Showing results for: “{activeKeyword}”</h3>
            <LawyerMap keyword={activeKeyword} refreshKey={searchNonce} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Advisors;
