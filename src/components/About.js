import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Compass, Target, Users, ShieldCheck } from 'lucide-react';
import './About.css';

const About = () => {
  const navigate = useNavigate();
  const { userEmail, logout } = useAuth();

  const pillars = [
    {
      icon: Compass,
      title: 'Clear Direction',
      text: 'Compass guides users through legal language with clear, educational explanations.'
    },
    {
      icon: Target,
      title: 'Practical Support',
      text: 'We focus on real tasks: document simplification, legal term lookup, and finding nearby legal advisors.'
    },
    {
      icon: Users,
      title: 'Community Access',
      text: 'Our goal is to make legal information easier to access for students, families, and local communities.'
    },
    {
      icon: ShieldCheck,
      title: 'Responsible AI',
      text: 'We provide educational support and encourage users to consult licensed attorneys for legal advice.'
    }
  ];

  const leadership = [
    {
      name: 'Staci Tranquille',
      role: 'Founder',
      bio: 'Designed the user interface and experience for Compass, translating complex legal workflows into intuitive interactions. Built and integrated APIs to ensure seamless communication between the frontend and backend systems.',
      image: '/images/head-shot.jpg'
    },
    {
      name: 'Darrell Pratt',
      role: 'Backend Engineer',
      bio: 'Developed and structured the Supabase database powering Compass, managing authentication and securely storing user data. Designed the schema for dictionary terms and legal references, enabling efficient access and retrieval across the platform.',
      image: '/images/IMG_0964%20(2).jpeg'
    },
    {
      name: 'Jalen Washington',
      role: 'Project Manager',
      bio: 'Oversaw project timelines, coordinated team efforts, and ensured clear communication between developers, designers, and stakeholders. Maintained alignment with the product vision and drove the project to successful delivery.',
      image: '/images/jalen.jpg'
    }
  ];

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="about-page">
      <nav className="about-nav">
        <div className="about-nav-container">
          <button type="button" className="about-brand" onClick={() => navigate('/home')}>
            <img src="/images/afro-pix-logo.png" alt="Legal Compass logo" className="about-brand-logo" />
            <div>
              <h2>Compass</h2>
              <p>About Our Company</p>
            </div>
          </button>
          <div className="about-actions">
            <button className="about-btn" onClick={() => navigate('/home')}>Home</button>
            <button className="about-btn" onClick={() => navigate('/search')}>AI Assistant</button>
            <span>{userEmail}</span>
            <button className="about-btn about-btn-secondary" onClick={handleLogout}>Logout</button>
          </div>
        </div>
      </nav>

      <main className="about-main">
        <section className="about-hero">
          <h1>About Compass</h1>
          <p>
            Compass is built to make legal information more approachable. We combine AI-powered explanation tools
            with practical resource navigation so users can better understand legal documents and next steps. We believe
            that everyone should understand their rights and should have equitable access to legal services regardless of class.
          </p>
        </section>

        <section className="about-grid">
          {pillars.map((pillar) => {
            const Icon = pillar.icon;
            return (
              <article key={pillar.title} className="about-card">
                <Icon size={20} />
                <h3>{pillar.title}</h3>
                <p>{pillar.text}</p>
              </article>
            );
          })}
        </section>

        <section className="about-leadership">
          <h2>Leadership</h2>
          <p>Meet the team guiding Compass.</p>
          <div className="leadership-grid">
            {leadership.map((leader) => (
              <article key={leader.name} className="leader-card" tabIndex="0">
                <div className="leader-card-inner">
                  <div className="leader-face leader-front">
                    <img
                      src={leader.image}
                      alt={`${leader.name} portrait`}
                      className="leader-photo"
                      onError={(event) => {
                        event.currentTarget.src = '/images/head-shot.jpg';
                      }}
                    />
                    <div className="leader-name-bar">
                      <h3>{leader.name}</h3>
                    </div>
                  </div>
                  <div className="leader-face leader-back">
                    <h3>{leader.name}</h3>
                    <span>{leader.role}</span>
                    <p>{leader.bio}</p>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
};

export default About;
