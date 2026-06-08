'use client';

import { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { 
  collection, 
  addDoc, 
  serverTimestamp, 
  query, 
  where, 
  getDocs 
} from 'firebase/firestore';

export default function Home() {
  // রেঅ্যাক্ট স্টেট সমূহ
  const [activeTab, setActiveTab] = useState('write'); // 'write' বা 'replies'
  const [senderName, setSenderName] = useState('');
  const [subject, setSubject] = useState('');
  const [letterBody, setLetterBody] = useState('');
  
  const [repliesList, setRepliesList] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  
  const [isMounted, setIsMounted] = useState(false);

  // SSR Hydration mismatch এড়ানোর জন্য গার্ড
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // ট্যাব পরিবর্তন করার সময় উত্তরপত্র অটোমেটিক লোড করা
  useEffect(() => {
    if (activeTab === 'replies' && isMounted) {
      loadReplies();
    }
  }, [activeTab, isMounted]);

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
  // ফায়ারবেসে চিঠি সাবমিট করার লজিক
  // ==========================================
  const handleFormSubmit = async (e) => {
    e.preventDefault();
    if (!subject.trim() || !letterBody.trim()) {
      alert('অনুগ্রহ করে বিষয় এবং চিঠির বর্ণনা দুটিই পূরণ করুন।');
      return;
    }

    setIsSubmitting(true);
    const finalSenderName = senderName.trim() ? senderName.trim() : 'অজানা';

    try {
      await addDoc(collection(db, 'letters'), {
        name: finalSenderName,
        subject: subject.trim(),
        body: letterBody.trim(),
        timestamp: serverTimestamp(),
        replied: false,
        replyText: '',
        repliedAt: null
      });

      // ফর্ম ক্লিয়ার
      setSenderName('');
      setSubject('');
      setLetterBody('');
      
      // সাকসেস মেসেজ টগল
      setShowSuccess(true);
    } catch (error) {
      console.error('চিঠি পাঠাতে সমস্যা হয়েছে: ', error);
      alert('দুঃখিত, চিঠিটি পাঠানো সম্ভব হয়নি।\nত্রুটির বিবরণ: ' + error.message + '\n\nঅনুগ্রহ করে পুনরায় চেষ্টা করুন।');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ==========================================
  // ফায়ারবেস থেকে উত্তরসহ চিঠি লোড করা
  // ==========================================
  const loadReplies = async () => {
    setIsLoading(true);
    try {
      const q = query(collection(db, 'letters'), where('replied', '==', true));
      const querySnapshot = await getDocs(q);
      
      const loaded = [];
      querySnapshot.forEach((doc) => {
        loaded.push({
          id: doc.id,
          ...doc.data()
        });
      });

      // ইন-মেমোরি সর্ট (নতুন চিঠি আগে দেখানোর জন্য)
      loaded.sort((a, b) => {
        const timeA = a.timestamp ? a.timestamp.seconds : 0;
        const timeB = b.timestamp ? b.timestamp.seconds : 0;
        return timeB - timeA;
      });

      setRepliesList(loaded);
    } catch (error) {
      console.error('উত্তরপত্র লোড করতে ব্যর্থ: ', error);
    } finally {
      setIsLoading(false);
    }
  };

  // ইন-মেমোরি সার্চ ফিল্টারিং
  const filteredRepliesList = repliesList.filter(letter => {
    const queryLower = searchQuery.toLowerCase().trim();
    if (!queryLower) return true;

    return (
      letter.name.toLowerCase().includes(queryLower) ||
      letter.subject.toLowerCase().includes(queryLower) ||
      letter.body.toLowerCase().includes(queryLower) ||
      (letter.replyText && letter.replyText.toLowerCase().includes(queryLower))
    );
  });

  if (!isMounted) {
    // হাইড্রেশন ইরর এড়ানোর জন্য মাউন্ট না হওয়া পর্যন্ত ব্ল্যাঙ্ক ভিউ রাখা
    return null;
  }

  return (
    <div className="desk-container">
      {/* ওয়েবসাইট হেডার */}
      <header>
        <h1><i className="fa-solid fa-feather-pointed"></i> চিঠি</h1>
        <p>স্মৃতির পাতায় জমা হোক কিছু বেনামী আবেগ</p>
      </header>

      {/* ডায়েরি ট্যাব সূচি */}
      <div className="diary-tabs">
        <button 
          className={`diary-tab ${activeTab === 'write' ? 'active' : ''}`} 
          onClick={() => setActiveTab('write')}
        >
          <i className="fa-solid fa-pen-fancy"></i> চিঠি লিখুন
        </button>
        <button 
          className={`diary-tab ${activeTab === 'replies' ? 'active' : ''}`} 
          onClick={() => setActiveTab('replies')}
        >
          <i className="fa-solid fa-book-open"></i> উত্তরপত্র
        </button>
      </div>

      {/* ডায়েরি মেইন পেজ */}
      <div className="diary-page">
        {/* মার্জিন ও স্পাইরাল রিং */}
        <div className="diary-margin"></div>
        <div className="spirals">
          {[...Array(10)].map((_, i) => (
            <div key={i} className="spiral-ring"></div>
          ))}
        </div>

        {/* ১. চিঠি লেখার ফর্ম সেকশন */}
        {activeTab === 'write' && (
          <div className="write-desk">
            <form onSubmit={handleFormSubmit}>
              <div className="form-group" style={{ marginBottom: '20px' }}>
                <label htmlFor="sender-name">
                  <i className="fa-regular fa-user"></i> আপনার নাম (ঐচ্ছিক):
                </label>
                <input 
                  type="text" 
                  id="sender-name" 
                  className="ink-input" 
                  placeholder="নাম প্রকাশ করতে না চাইলে খালি রাখুন (অজানা হিসেবে জমা হবে)..." 
                  value={senderName}
                  onChange={(e) => setSenderName(e.target.value)}
                  autoComplete="off"
                />
              </div>

              <div className="form-group" style={{ marginBottom: '20px' }}>
                <label htmlFor="letter-subject">
                  <i className="fa-regular fa-bookmark"></i> বিষয় (বাধ্যতামূলক):
                </label>
                <input 
                  type="text" 
                  id="letter-subject" 
                  className="ink-input" 
                  placeholder="চিঠির একটি বিষয় দিন..." 
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  required 
                  autoComplete="off"
                />
              </div>

              <div className="form-group">
                <label htmlFor="letter-body">
                  <i className="fa-solid fa-align-left"></i> আপনার চিঠি (বাধ্যতামূলক):
                </label>
                <div className="ruled-container">
                  <textarea 
                    id="letter-body" 
                    className="ruled-textarea" 
                    placeholder="আপনার মনের অনুভূতিগুলো এখানে কালির আঁচড়ে প্রকাশ করুন..." 
                    value={letterBody}
                    onChange={(e) => setLetterBody(e.target.value)}
                    required
                  ></textarea>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '25px' }}>
                <button 
                  type="submit" 
                  className="send-btn" 
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <span>পাঠানো হচ্ছে...</span> 
                      <i className="fa-solid fa-spinner fa-spin"></i>
                    </>
                  ) : (
                    <>
                      <span>চিঠি পাঠান</span> 
                      <i className="fa-regular fa-paper-plane"></i>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ২. পাবলিক উত্তরপত্র সেকশন */}
        {activeTab === 'replies' && (
          <div className="replies-feed-container">
            {/* সার্চ বক্স */}
            <div className="search-box">
              <input 
                type="text" 
                className="ink-input" 
                placeholder="বিষয় বা প্রেরকের নাম দিয়ে চিঠি খুঁজুন..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <span style={{ display: 'flex', alignItems: 'center', padding: '0 10px', color: '#8d6e63' }}>
                <i className="fa-solid fa-magnifying-glass"></i>
              </span>
            </div>

            {/* লোডার */}
            {isLoading && (
              <div className="loading-view">
                <div className="spinner"></div>
                <p>স্মৃতির পাতা উল্টানো হচ্ছে...</p>
              </div>
            )}

            {/* কোনো রেকর্ড না থাকলে */}
            {!isLoading && filteredRepliesList.length === 0 && (
              <div className="empty-view">
                <i className="fa-regular fa-folder-open" style={{ fontSize: '2.5rem', marginBottom: '10px', display: 'block', color: '#c2b090' }}></i>
                {searchQuery.trim() ? 'আপনার খোঁজা অনুযায়ী কোনো চিঠি মেলেনি।' : 'এখনো কোনো চিঠির উত্তর দেওয়া হয়নি। শীঘ্রই নতুন পাতা যুক্ত হবে!'}
              </div>
            )}

            {/* চিঠির গ্রিড */}
            {!isLoading && filteredRepliesList.length > 0 && (
              <div className="letters-grid">
                {filteredRepliesList.map((letter) => (
                  <div key={letter.id} className="letter-card">
                    <div className="tape-effect"></div>
                    
                    {/* চিঠির মেটা তথ্য */}
                    <div className="letter-meta">
                      <span className="letter-sender">
                        <i className="fa-regular fa-envelope"></i> প্রেরক: {letter.name}
                      </span>
                      <span>
                        <i className="fa-regular fa-clock"></i> {formatBengaliDate(letter.timestamp)}
                      </span>
                    </div>
                    
                    {/* বিষয় ও বর্ণনা */}
                    <div className="letter-subject">{letter.subject}</div>
                    <div className="letter-body">{letter.body}</div>
                    
                    {/* উত্তর স্টিকি নোট */}
                    {letter.replied && (
                      <div className="reply-attachment">
                        <div className="reply-tape"></div>
                        <div className="reply-header">
                          <span><i class="fa-solid fa-reply"></i> ডায়েরি থেকে উত্তর:</span>
                          <span style={{ fontSize: '0.8rem', fontWeight: 'normal', color: '#8d6e63' }}>
                            <i className="fa-regular fa-calendar-check"></i> {formatBengaliDate(letter.repliedAt)}
                          </span>
                        </div>
                        <div className="reply-body">{letter.replyText}</div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ফুটার */}
      <footer>
        <p>© ২০২৬ <a href="/">চিঠি (CiThi)</a> | সর্বস্বত্ব সংরক্ষিত</p>
      </footer>

      {/* সাকসেস মডেল */}
      <div className={`success-modal ${showSuccess ? 'active' : ''}`}>
        <div className="envelope-card">
          <div className="wax-seal">সিল</div>
          <h3>চিঠিটি পাঠানো হয়েছে!</h3>
          <p>
            আপনার চিঠিটি অত্যন্ত যত্নসহকারে ভাঁজ করে ডায়েরিতে রেখে দেওয়া হয়েছে। প্রচ্ছদের "উত্তরপত্র" ট্যাবে নিয়মিত চোখ রাখুন, উত্তর দেওয়া হলে সেটি সেখানে প্রকাশ করা হবে।
          </p>
          <button className="close-modal-btn" onClick={() => setShowSuccess(false)}>
            ডায়েরি বন্ধ করুন
          </button>
        </div>
      </div>
    </div>
  );
}
