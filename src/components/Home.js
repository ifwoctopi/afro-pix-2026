import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { FileText, Book, MapPin, Brain, Compass, ShieldCheck, Sparkles } from 'lucide-react';
import './Home.css';

const Home = () => {
  const navigate = useNavigate();
  const { userEmail, logout } = useAuth();

  const navCards = [
    {
      title: 'Juris',
      description: 'Simplify legal documents or ask questions and get plain-language explanations in seconds.',
      icon: FileText,
      route: '/search',
      cta: 'Open Assistant'
    },
    {
      title: 'Lexis',
      description: 'Look up legal terms with fast, easy-to-understand definitions.',
      icon: Book,
      route: '/dictionary',
      cta: 'Browse Glossary'
    },
    {
      title: 'Navis',
      description: 'Find nearby attorneys and legal aid clinics by specialty and location.',
      icon: MapPin,
      route: '/advisors',
      cta: 'Open Map'
    },
    {
      title: 'Probus',
      description: 'Test your legal understanding with quick interactive practice questions.',
      icon: Brain,
      route: '/quiz',
      cta: 'Start Quiz'
    }
  ];

  const highlights = [
    {
      icon: ShieldCheck,
      title: 'Trustworthy Guidance',
      text: 'Designed to explain legal language clearly while encouraging professional legal support when needed.'
    },
    {
      icon: Sparkles,
      title: 'Fast and Interactive',
      text: 'Upload documents, ask questions, and navigate to legal resources in one connected workflow.'
    }
  ];

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="home-page">
      <nav className="home-nav">
        <div className="home-nav-container">
          <div className="home-brand">
            <img src="/images/afro-pix-logo.png" alt="Legal Compass logo" className="home-brand-logo" />
            <div>
              <h2>Compass</h2>
              <p>Legal Access for All</p>
            </div>
          </div>
          <div className="home-user-actions">
            <button className="home-btn home-btn-secondary" onClick={() => navigate('/about')}>About</button>
            <span>{userEmail}</span>
            <button className="home-btn home-btn-secondary" onClick={handleLogout}>Logout</button>
          </div>
        </div>
      </nav>

      <main className="home-main">
        <section className="home-hero">
          <div className="home-hero-top">
            <div className="home-hero-compass-shell" aria-hidden="true">
              <Compass className="home-hero-compass-icon" size={36} />
            </div>
            <div>
              <h1>Welcome to Compass</h1>
              <p>
                We help people understand legal documents, learn legal terms, and connect with the right legal support.
                Choose a tool below to get started.
              </p>
            </div>
          </div>
        </section>

        <section className="home-highlights">
          {highlights.map((item) => {
            const Icon = item.icon;
            return (
              <article key={item.title} className="home-highlight-card">
                <Icon size={20} />
                <div>
                  <h3>{item.title}</h3>
                  <p>{item.text}</p>
                </div>
              </article>
            );
          })}
        </section>

        <section className="home-nav-grid" aria-label="Main navigation">
          {navCards.map((card) => {
            const Icon = card.icon;
            return (
              <button
                key={card.title}
                className="home-nav-card"
                onClick={() => navigate(card.route)}
              >
                <div className="home-card-top">
                  <Icon size={20} />
                  <h3>{card.title}</h3>
                </div>
                <p>{card.description}</p>
                <span>{card.cta} →</span>
              </button>
            );
          })}
        </section>
      </main>
    </div>
  );
};

export default Home;
