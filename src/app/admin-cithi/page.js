'use client';

import { useState, useEffect } from 'react';
import { db, ADMIN_PASSWORD } from '../../lib/firebase';
import { 
  collection, 
  getDocs, 
  doc, 
  updateDoc, 
  deleteDoc, 
  serverTimestamp 
} from 'firebase/firestore';

export default function AdminCithi() {
  // রেঅ্যাক্ট স্টেট সমূহ
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [loginError, setLoginError] = useState('');
  
  const [lettersList, setLettersList] = useState([]);
  const [currentFilter, setCurrentFilter] = useState('all'); // 'all', 'pending', 'replied'
  const [isLoading, setIsLoading] = useState(false);
  
  // চিঠি প্রতি পৃথক উত্তর ও টেক্সট ফর্ম টগল করার জন্য অবজেক্ট স্টেট
  const [replyTexts, setReplyTexts] = useState({});
  const [activeReplyForms, setActiveReplyForms] = useState({});
  
  const [isMounted, setIsMounted] = useState(false);

  // পেজ লোডে অথেনটিকেশন চেক
  useEffect(() => {
    setIsMounted(true);
    const isVerified = sessionStorage.getItem('cithi_admin_verified');
    if (isVerified === 'true') {
      setIsAuthenticated(true);
    }
  }, []);

  // লগইন সফল হলে তথ্য লোড করা
  useEffect(() => {
    if (isAuthenticated && isMounted) {
      loadLetters();
    }
  }, [isAuthenticated, isMounted]);

  // ==========================================
  // সহায়ক ফাংশন: ইংরেজি সংখ্যাকে বাংলায় রূপান্তর
  // ==========================================
  const toBengaliNumber = (num) => {
    const BENGALI_NUMERALS = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
    return String(num).split('').map(digit => BENGALI_NUMERALS[digit] || digit).join('');
  };

  // ==========================================
  // সহায়ক ফাংশন: তারিখকে বাংলা ফরম্যাটে রূপান্তর
  // ==========================================
  const formatBengaliDate = (timestamp) => {
    if (!timestamp) return 'কিছুক্ষণ আগে';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const months = [
      'জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল', 'মে', 'জুন', 
      'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর'
    ];
    
    const day = toBengaliNumber(date.getDate());
    const month = months[date.getMonth()];
    const year = toBengaliNumber(date.getFullYear());
    
    let hours = date.getHours();
    const minutes = toBengaliNumber(String(date.getMinutes()).padStart(2, '0'));
    
    let period = 'সকাল';
    if (hours >= 12) {
      period = 'বিকাল/রাত';
      if (hours > 12) hours -= 12;
    } else {
      if (hours === 0) hours = 12;
      if (hours >= 5 && hours < 12) period = 'সকাল/দুপুর';
    }
    
    const hoursBengali = toBengaliNumber(hours);
    return `${day} ${month}, ${year} (সময়: ${period} ${hoursBengali}:${minutes})`;
  };

  // ==========================================
  // লগইন করার হ্যান্ডলার
  // ==========================================
  const handleLoginSubmit = (e) => {
    e.preventDefault();
    setLoginError('');
    
    if (passwordInput.trim() === ADMIN_PASSWORD) {
      sessionStorage.setItem('cithi_admin_verified', 'true');
      setIsAuthenticated(true);
      setPasswordInput('');
    } else {
      setLoginError('ভুল চাবিকাঠি! অনুগ্রহ করে সঠিক পাসওয়ার্ড দিয়ে চেষ্টা করুন।');
      setPasswordInput('');
    }
  };

  // ==========================================
  // লগআউট হ্যান্ডলার
  // ==========================================
  const handleLogout = () => {
    sessionStorage.removeItem('cithi_admin_verified');
    setIsAuthenticated(false);
  };

  // ==========================================
  // সকল চিঠি লোড করার হ্যান্ডলার
  // ==========================================
  const loadLetters = async () => {
    setIsLoading(true);
    try {
      const querySnapshot = await getDocs(collection(db, 'letters'));
      const loaded = [];
      querySnapshot.forEach((doc) => {
        loaded.push({
          id: doc.id,
          ...doc.data()
        });
      });

      // নতুন চিঠি আগে দেখানোর সর্টিং
      loaded.sort((a, b) => {
        const timeA = a.timestamp ? a.timestamp.seconds : 0;
        const timeB = b.timestamp ? b.timestamp.seconds : 0;
        return timeB - timeA;
      });

      setLettersList(loaded);
    } catch (error) {
      console.error('চিঠিপত্র লোড করা সম্ভব হয়নি: ', error);
      alert('সার্ভার থেকে তথ্য রিড করতে সমস্যা হচ্ছে।');
    } finally {
      setIsLoading(false);
    }
  };

  // ==========================================
  // উত্তর ফর্ম ওপেন/ক্লোজ করা
  // ==========================================
  const toggleReplyForm = (id, currentText = '') => {
    setActiveReplyForms(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
    
    // পূর্ববর্তী টেক্সট থাকলে তা ফিল্ডে বসানো
    if (!replyTexts[id]) {
      setReplyTexts(prev => ({
        ...prev,
        [id]: currentText
      }));
    }
  };

  const handleReplyTextChange = (id, text) => {
    setReplyTexts(prev => ({
      ...prev,
      [id]: text
    }));
  };

  // ==========================================
  // উত্তর পাঠানোর হ্যান্ডলার
  // ==========================================
  const submitReply = async (id) => {
    const text = replyTexts[id] || '';
    if (!text.trim()) {
      alert('উত্তর দিতে টেক্সট এরিয়াটি পূরণ করুন।');
      return;
    }

    setIsLoading(true);
    try {
      const letterRef = doc(db, 'letters', id);
      await updateDoc(letterRef, {
        replied: true,
        replyText: text.trim(),
        repliedAt: serverTimestamp()
      });

      // ফর্মটি বন্ধ করে দেওয়া
      setActiveReplyForms(prev => ({
        ...prev,
        [id]: false
      }));

      // ডাটা রিলোড
      await loadLetters();
    } catch (error) {
      console.error('উত্তর পাঠাতে ব্যর্থ: ', error);
      alert('ত্রুটি! উত্তরটি ডেটাবেজে সংরক্ষণ করা যায়নি।');
    } finally {
      setIsLoading(false);
    }
  };

  // ==========================================
  // চিঠি ডিলিট করার হ্যান্ডলার
  // ==========================================
  const handleDelete = async (id) => {
    const isConfirmed = confirm('আপনি কি নিশ্চিতভাবে এই চিঠিটি ডিলিট করতে চান? এটি আর ফিরিয়ে আনা যাবে না।');
    if (!isConfirmed) return;

    setIsLoading(true);
    try {
      await deleteDoc(doc(db, 'letters', id));
      await loadLetters();
    } catch (error) {
      console.error('চিঠি ডিলিট করতে ব্যর্থ: ', error);
      alert('ত্রুটি! চিঠিটি মুছে ফেলা সম্ভব হয়নি।');
    } finally {
      setIsLoading(false);
    }
  };

  // স্ট্যাটিস্টিকস
  const totalCount = lettersList.length;
  const pendingCount = lettersList.filter(l => !l.replied).length;
  const repliedCount = lettersList.filter(l => l.replied).length;

  // ফিল্টারিং
  const filteredLetters = lettersList.filter(letter => {
    if (currentFilter === 'all') return true;
    if (currentFilter === 'pending') return !letter.replied;
    if (currentFilter === 'replied') return letter.replied;
    return true;
  });

  if (!isMounted) {
    return null;
  }

  // ১. লগইন না থাকলে লক স্ক্রিন দেখানো হবে
  if (!isAuthenticated) {
    return (
      <div className="desk-container">
        <div className="lock-screen-container">
          <div className="lock-card">
            <div className="tape-effect" style={{ left: '38%', width: '100px' }}></div>
            <div className="lock-icon">
              <i className="fa-solid fa-lock"></i>
            </div>
            <h2>গোপন ডায়েরি</h2>
            <p>এই ডায়েরির পৃষ্ঠাগুলোতে প্রবেশ করতে সঠিক গোপন চাবিকাঠি দিন।</p>
            
            <form onSubmit={handleLoginSubmit}>
              <div className="form-group" style={{ textAlign: 'left' }}>
                <label htmlFor="admin-pass"><i className="fa-solid fa-lock-open"></i> গোপন চাবিকাঠি:</label>
                <input 
                  type="password" 
                  id="admin-pass" 
                  className="ink-input" 
                  placeholder="পাসওয়ার্ড লিখুন..." 
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  required 
                  autoComplete="current-password"
                />
              </div>
              {loginError && <div className="error-message">{loginError}</div>}
              <button type="submit"><i className="fa-solid fa-book-bookmark"></i> ডায়েরি খুলুন</button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  // ২. লগইন করা থাকলে মূল ড্যাশবোর্ড
  return (
    <div className="desk-container">
      {/* ড্যাশবোর্ড হেডার */}
      <header>
        <h1><i className="fa-solid fa-user-gear"></i> গোপন ডায়েরি</h1>
        <p>পাঠকদের পাঠানো অপ্রকাশিত চিঠির উত্তর ও পরিচালনা কক্ষ</p>
      </header>

      <div className="diary-page">
        {/* মার্জিন ও স্পাইরাল রিং */}
        <div className="diary-margin"></div>
        <div className="spirals">
          {[...Array(10)].map((_, i) => (
            <div key={i} className="spiral-ring"></div>
          ))}
        </div>

        {/* স্ট্যাটস গ্রিড */}
        <div className="admin-stats-grid">
          <div className="stat-item">
            <div className="stat-val">{toBengaliNumber(totalCount)}</div>
            <div className="stat-label">মোট চিঠি</div>
          </div>
          <div className="stat-item">
            <div className="stat-val" style={{ color: '#d84315' }}>{toBengaliNumber(pendingCount)}</div>
            <div className="stat-label">অনিষ্পন্ন চিঠি</div>
          </div>
          <div className="stat-item">
            <div className="stat-val" style={{ color: '#2e7d32' }}>{toBengaliNumber(repliedCount)}</div>
            <div className="stat-label">উত্তর দেওয়া হয়েছে</div>
          </div>
        </div>

        {/* ফিল্টার এবং লগআউট বাটন */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '15px' }}>
          <div className="admin-filters">
            <button 
              className={`filter-btn ${currentFilter === 'all' ? 'active' : ''}`}
              onClick={() => setCurrentFilter('all')}
            >
              সব চিঠি
            </button>
            <button 
              className={`filter-btn ${currentFilter === 'pending' ? 'active' : ''}`}
              onClick={() => setCurrentFilter('pending')}
            >
              অনিষ্পন্ন
            </button>
            <button 
              className={`filter-btn ${currentFilter === 'replied' ? 'active' : ''}`}
              onClick={() => setCurrentFilter('replied')}
            >
              উত্তর দেওয়া হয়েছে
            </button>
          </div>
          
          <button 
            className="action-btn delete-btn" 
            onClick={handleLogout}
            style={{ padding: '8px 15px', backgroundColor: '#f5f5f5', color: '#5d4037', border: '1px solid #c2b090' }}
          >
            <i className="fa-solid fa-right-from-bracket"></i> ডায়েরি বন্ধ করুন
          </button>
        </div>

        {/* লোডিং */}
        {isLoading && (
          <div className="loading-view">
            <div className="spinner"></div>
            <p>চিঠির পাতা উল্টানো হচ্ছে...</p>
          </div>
        )}

        {/* খালি লিস্ট */}
        {!isLoading && filteredLetters.length === 0 && (
          <div className="empty-view">
            <i className="fa-regular fa-envelope-open" style={{ fontSize: '2.5rem', marginBottom: '10px', display: 'block', color: '#c2b090' }}></i>
            কোনো চিঠি পাওয়া যায়নি।
          </div>
        )}

        {/* চিঠি গ্রিড */}
        {!isLoading && filteredLetters.length > 0 && (
          <div className="letters-grid">
            {filteredLetters.map((letter) => (
              <div key={letter.id} className="letter-card">
                <div className="tape-effect"></div>

                {/* চিঠির মেটা ও স্ট্যাটাস */}
                <div className="letter-meta">
                  <span className="letter-sender">
                    <i className="fa-regular fa-envelope"></i> প্রেরক: {letter.name}
                  </span>
                  <span style={{ color: letter.replied ? '#2e7d32' : '#d84315', fontWeight: 'bold' }}>
                    <i className="fa-solid fa-tag"></i> {letter.replied ? 'উত্তর দেওয়া হয়েছে' : 'উত্তর বাকি'}
                  </span>
                </div>
                
                <div style={{ fontFamily: 'Noto Serif Bengali, serif', fontSize: '0.85rem', color: '#8d6e63', marginTop: '-6px', marginBottom: '12px' }}>
                  <i className="fa-regular fa-clock"></i> {formatBengaliDate(letter.timestamp)}
                </div>

                {/* বিষয় ও বর্ণনা */}
                <div className="letter-subject">{letter.subject}</div>
                <div className="letter-body">{letter.body}</div>

                {/* উত্তর সংযুক্তকরণ (পূর্বের রিপ্লাই দেখালে) */}
                {letter.replied && !activeReplyForms[letter.id] && (
                  <div className="reply-attachment">
                    <div className="reply-tape"></div>
                    <div className="reply-header">
                      <span><i className="fa-solid fa-reply"></i> আপনার দেওয়া উত্তর:</span>
                      <span style={{ fontSize: '0.8rem', fontWeight: 'normal', color: '#8d6e63' }}>
                        <i className="fa-regular fa-calendar-check"></i> {formatBengaliDate(letter.repliedAt)}
                      </span>
                    </div>
                    <div className="reply-body">{letter.replyText}</div>
                  </div>
                )}

                {/* উত্তর এডিট/লেখার ইনপুট ফর্ম */}
                {activeReplyForms[letter.id] && (
                  <div className="admin-reply-box">
                    <textarea 
                      placeholder="চিঠির জবাব বাংলায় লিখুন..."
                      value={replyTexts[letter.id] || ''}
                      onChange={(e) => handleReplyTextChange(letter.id, e.target.value)}
                      required
                    ></textarea>
                    <div className="reply-actions">
                      <button 
                        className="action-btn" 
                        onClick={() => toggleReplyForm(letter.id)}
                        style={{ backgroundColor: '#f5f5f5', color: '#5d4037', border: '1px solid #ebd9c2' }}
                      >
                        বাতিল
                      </button>
                      <button 
                        className="action-btn reply-btn" 
                        onClick={() => submitReply(letter.id)}
                      >
                        <i className="fa-solid fa-paper-plane"></i> পাঠান
                      </button>
                    </div>
                  </div>
                )}

                {/* অ্যাডমিন অ্যাকশন বাটনসমূহ */}
                <div className="card-actions">
                  <button 
                    className="action-btn reply-btn" 
                    onClick={() => toggleReplyForm(letter.id, letter.replyText)}
                  >
                    <i className="fa-regular fa-comment-dots"></i> {letter.replied ? 'উত্তর এডিট করুন' : 'উত্তর দিন'}
                  </button>
                  <button 
                    className="action-btn delete-btn" 
                    onClick={() => handleDelete(letter.id)}
                  >
                    <i className="fa-regular fa-trash-can"></i> ডিলিট করুন
                  </button>
                </div>

              </div>
            ))}
          </div>
        )}
      </div>

      {/* ফুটার */}
      <footer>
        <p>© ২০২৬ <a href="/">চিঠি (CiThi)</a> | সর্বস্বত্ব সংরক্ষিত</p>
      </footer>
    </div>
  );
}
