import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { supabase } from './lib/supabase';

// ─── Types ───────────────────────────────────────────────────────────
interface ShortLinkData {
  id: string;
  code: string;
  url: string;
  clicks: number;
  created_at: string;
}

interface ArticleData {
  category: string;
  publishDate: string;
  author: string;
  readTime: string;
  title: string;
  slug: string;
  metaDescription: string;
  content: string;
}

interface SettingsData {
  custom_domain: string;
}

type Tab = 'home' | 'create' | 'settings';

// ─── Toast System ────────────────────────────────────────────────────
interface ToastData {
  id: number;
  title: string;
  description?: string;
  variant?: 'default' | 'destructive';
}

let toastId = 0;

function useToast() {
  const [toasts, setToasts] = useState<ToastData[]>([]);

  const addToast = useCallback((data: Omit<ToastData, 'id'>) => {
    const id = ++toastId;
    setToasts(prev => [...prev, { ...data, id }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3000);
  }, []);

  const toast = useCallback((data: { title: string; description?: string; variant?: 'default' | 'destructive' }) => {
    addToast(data);
  }, [addToast]);

  const removeToast = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  return { toasts, toast, removeToast };
}

function ToastContainer({ toasts, onRemove }: { toasts: ToastData[]; onRemove: (id: number) => void }) {
  if (toasts.length === 0) return null;
  return (
    <div className="fixed bottom-20 md:bottom-6 right-4 z-[100] flex flex-col gap-2 max-w-sm">
      {toasts.map(t => (
        <div
          key={t.id}
          className={`animate-toast-in px-4 py-3 rounded-xl shadow-lg border backdrop-blur-xl text-sm cursor-pointer ${
            t.variant === 'destructive'
              ? 'bg-red-500/90 border-red-500/50 text-white'
              : 'bg-gray-800/90 border-gray-700 text-white'
          }`}
          onClick={() => onRemove(t.id)}
        >
          <div className="font-semibold">{t.title}</div>
          {t.description && <div className="text-gray-300 text-xs mt-0.5">{t.description}</div>}
        </div>
      ))}
    </div>
  );
}

// ─── Constants ───────────────────────────────────────────────────────
function ensureProtocol(url: string): string {
  if (!url.trim()) return '';
  const trimmed = url.trim().replace(/\/+$/, '');
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return 'https://' + trimmed;
}

function getDomain(customDomain?: string): string {
  if (customDomain && customDomain.trim()) {
    return ensureProtocol(customDomain) + '/#';
  }
  if (typeof window !== 'undefined') {
    return window.location.origin + window.location.pathname.replace(/\/$/, '') + '/#';
  }
  return '';
}

const RANDOM_EMOJIS = [
  '🔞', '🔞', '🔞', '🔞', '🔞',
  '▶️', '▶️', '▶️', '▶️',
  '⏺️', '⏺️', '⏺️',
  '▶️', '⏸️', '⏹️',
  '👉', '👆', '👇', '👈', '☝️',
  '▶️', '⏩', '⏪',
  '🎥', '🎬', '📹', '📽️', '🎞️',
  '⚠️', '❗', '❕', '‼️',
  '📢', '🔔', '📣',
];

function getRandomEmoji(): string {
  return RANDOM_EMOJIS[Math.floor(Math.random() * RANDOM_EMOJIS.length)];
}

const DEFAULT_WA_URL = '';

const ARTICLES: ArticleData[] = [
  { category: 'Technology', publishDate: '2025-01-15', author: 'Tech Daily', readTime: '5 min read', title: 'The Future of URL Shortening Services', slug: 'future-of-url-shortening', metaDescription: 'Exploring how URL shortening services are evolving in the modern web era with new features and enhanced security.', content: '<p>URL shortening services have become an essential tool in the digital age. From social media sharing to marketing campaigns, short URLs provide convenience and trackability that long URLs simply cannot match.</p><p>Modern shortening services now offer advanced analytics, custom aliases, QR code generation, and even safelink features that protect users from malicious destinations.</p>' },
  { category: 'Security', publishDate: '2025-01-10', author: 'CyberSafe', readTime: '4 min read', title: 'Understanding Safelink Technology', slug: 'understanding-safelink', metaDescription: 'Learn how safelink technology works to protect users from potentially harmful URLs.', content: '<p>Safelink technology acts as a protective intermediary between users and destination URLs. When a user clicks a shortlink, the safelink page verifies the destination and shows a countdown timer before redirecting.</p><p>This approach helps prevent accidental visits to malicious sites and gives users a moment to review where they are being directed.</p>' },
  { category: 'Digital Marketing', publishDate: '2025-01-05', author: 'Growth Hub', readTime: '6 min read', title: 'Maximizing Link Click-Through Rates', slug: 'maximizing-ctr', metaDescription: 'Strategies to improve your link click-through rates using shortened URLs and data-driven optimization.', content: '<p>Shortened URLs can significantly impact your click-through rates. Studies show that branded short URLs receive up to 39% more clicks compared to generic long URLs.</p><p>By analyzing click data from your shortlinks, you can identify peak engagement times, preferred platforms, and optimize your content distribution strategy.</p>' },
  { category: 'Health & Wellness', publishDate: '2025-01-18', author: 'HealthyLife', readTime: '4 min read', title: '5 Simple Habits to Boost Your Daily Energy', slug: 'boost-daily-energy', metaDescription: 'Discover easy daily habits that can help you feel more energetic and productive throughout the day.', content: '<p>Feeling tired all the time? You are not alone. Millions of people struggle with low energy levels daily. The good news is that small changes to your routine can make a big difference.</p><p>Start by drinking a glass of water first thing in the morning. Your body loses water overnight, and rehydrating kickstarts your metabolism.</p>' },
  { category: 'Lifestyle', publishDate: '2025-01-12', author: 'LifeHacks', readTime: '3 min read', title: 'How to Stay Focused in a World Full of Distractions', slug: 'stay-focused-tips', metaDescription: 'Practical tips to improve your concentration and get more done in less time.', content: '<p>In today\'s hyper-connected world, staying focused is harder than ever. The Pomodoro Technique is one of the most effective methods: work for 25 minutes, then take a 5-minute break.</p><p>This simple framework helps your brain maintain high performance throughout the day.</p>' },
  { category: 'Finance', publishDate: '2025-01-08', author: 'MoneyWise', readTime: '5 min read', title: 'Beginner Guide to Smart Money Management', slug: 'smart-money-management', metaDescription: 'Essential money management tips for beginners to build a strong financial foundation.', content: '<p>Managing your money wisely does not require a finance degree. Create a monthly budget using the 50/30/20 rule: 50% for needs, 30% for wants, and 20% for savings.</p><p>Automating your savings makes it effortless to build an emergency fund over time.</p>' },
  { category: 'Education', publishDate: '2025-01-03', author: 'LearnToday', readTime: '4 min read', title: 'Why Online Learning is the Future of Education', slug: 'online-learning-future', metaDescription: 'Exploring the rise of online education and how it is transforming the way we learn new skills.', content: '<p>Online learning has exploded in popularity. It offers flexibility, affordability, and access to world-class instructors from anywhere in the world.</p><p>Dedicating just 30 minutes a day to learning can lead to mastery over time.</p>' },
  { category: 'Technology', publishDate: '2024-12-25', author: 'TechInsider', readTime: '4 min read', title: '5 Must-Have Apps to Organize Your Life in 2025', slug: 'must-have-apps-2025', metaDescription: 'Discover the top productivity apps that will help you stay organized and get more done this year.', content: '<p>With thousands of apps available, choosing the right tools can be overwhelming. Start with one category like task management, master it, then gradually add more tools.</p><p>Quality over quantity is the secret to digital productivity.</p>' },
  { category: 'Food & Nutrition', publishDate: '2025-01-20', author: 'EatWell', readTime: '3 min read', title: 'Quick and Healthy Breakfast Ideas for Busy Mornings', slug: 'healthy-breakfast-ideas', metaDescription: 'Nutritious breakfast recipes that take less than 5 minutes to prepare.', content: '<p>Breakfast is the most important meal of the day. Try overnight oats with banana and honey, or a smoothie bowl with frozen berries and Greek yogurt.</p><p>These options provide sustained energy and can be prepared the night before.</p>' },
  { category: 'Travel', publishDate: '2025-01-16', author: 'WanderGuide', readTime: '5 min read', title: 'Top Budget Travel Destinations for 2025', slug: 'budget-travel-destinations', metaDescription: 'Affordable travel destinations that offer amazing experiences without breaking the bank.', content: '<p>Travel does not have to be expensive. Countries in Southeast Asia like Vietnam, Indonesia, and Thailand offer incredible food, stunning landscapes, and rich cultural experiences.</p><p>Plan ahead, travel during off-peak seasons, and you can explore the world on any budget.</p>' },
  { category: 'Motivation', publishDate: '2025-01-22', author: 'MindSet', readTime: '3 min read', title: 'How to Build Discipline and Achieve Your Goals', slug: 'build-discipline-goals', metaDescription: 'Practical strategies to develop self-discipline and turn your dreams into reality.', content: '<p>Motivation gets you started, but discipline keeps you going. Start by setting small, achievable goals to build momentum.</p><p>Small wins create the habit loops that lead to lasting change.</p>' },
  { category: 'Social Media', publishDate: '2025-01-14', author: 'SocialPro', readTime: '4 min read', title: 'How to Grow Your Social Media Presence Organically', slug: 'grow-social-media', metaDescription: 'Proven strategies to build an engaged audience on social media without paid advertising.', content: '<p>Focus on quality content that educates, entertains, or inspires. Post consistently, engage with your followers, and use relevant hashtags.</p><p>Authenticity beats perfection every time on social media.</p>' },
  { category: 'Science', publishDate: '2025-01-09', author: 'ScienceDaily', readTime: '5 min read', title: 'Amazing Science Discoveries That Changed the World', slug: 'science-discoveries', metaDescription: 'A look back at some of the most impactful scientific discoveries and how they shape our daily lives.', content: '<p>From the discovery of penicillin to the invention of the internet, science has continuously transformed how we live.</p><p>Recent advances in AI, gene editing, and renewable energy are shaping the next chapter of human progress.</p>' },
  { category: 'Productivity', publishDate: '2024-12-20', author: 'WorkSmart', readTime: '3 min read', title: 'Top 10 Tips for Managing Short Links', slug: 'tips-managing-short-links', metaDescription: 'Best practices for organizing, tracking, and managing your shortened URLs effectively.', content: '<p>Effective link management starts with consistent naming conventions and proper categorization.</p><p>Regularly review your analytics to identify top-performing links and retire unused ones.</p>' },
  { category: 'Web Development', publishDate: '2024-12-28', author: 'DevPulse', readTime: '5 min read', title: 'Building Your Own URL Shortener', slug: 'build-url-shortener', metaDescription: 'A comprehensive guide on how to build a custom URL shortener with modern web technologies.', content: '<p>Building a URL shortener is an excellent project for developers looking to strengthen their full-stack skills.</p><p>With technologies like React, Vite, and Supabase, you can create a performant and scalable URL shortener.</p>' },
];

// ─── Helpers ─────────────────────────────────────────────────────────
function getRandomArticle(): ArticleData {
  return ARTICLES[Math.floor(Math.random() * ARTICLES.length)];
}

function formatCreatedAt(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleString();
  } catch {
    return dateStr;
  }
}

function copyText(text: string, toast: (data: { title: string; description?: string; variant?: 'default' | 'destructive' }) => void) {
  navigator.clipboard.writeText(text).then(() => {
    toast({ title: 'Copied!', description: 'Link copied to clipboard' });
  }).catch(() => {
    toast({ title: 'Error', description: 'Failed to copy', variant: 'destructive' });
  });
}

function maskUrl(url: string): string {
  if (!url) return 'Not configured';
  try {
    const u = new URL(url);
    return `${u.protocol}//${u.hostname}`;
  } catch {
    return url.slice(0, 30) + '...';
  }
}

// ─── PIN Verification ────────────────────────────────────────────────
async function verifyPin(pin: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'admin_pin')
      .single();
    if (!error && data) {
      return pin === data.value;
    }
  } catch {
    // Table might not exist yet
  }
  const envPin = import.meta.env.VITE_ADMIN_PIN || '270491';
  return pin === envPin;
}

// ─── Icons (inline SVG components) ──────────────────────────────────
function IconLink({ className = 'w-6 h-6' }: { className?: string }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>;
}
function IconPlus({ className = 'w-6 h-6' }: { className?: string }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>;
}
function IconCog({ className = 'w-6 h-6' }: { className?: string }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>;
}
function IconLock({ className = 'w-10 h-10' }: { className?: string }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>;
}
function IconHome({ className = 'w-6 h-6' }: { className?: string }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>;
}
function IconTrash({ className = 'w-5 h-5' }: { className?: string }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>;
}
function IconCopy({ className = 'w-5 h-5' }: { className?: string }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>;
}
function IconLogout({ className = 'w-5 h-5' }: { className?: string }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>;
}
function IconChartBar({ className = 'w-6 h-6' }: { className?: string }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>;
}
function IconSearch({ className = 'w-5 h-5' }: { className?: string }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>;
}
function IconDownload({ className = 'w-5 h-5' }: { className?: string }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>;
}
function IconQrCode({ className = 'w-5 h-5' }: { className?: string }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 3h7v7H3V3zm11 0h7v7h-7V3zM3 14h7v7H3v-7zm14 3h.01" /><path strokeLinecap="round" strokeLinejoin="round" d="M14 14h3v3h-3v-3z" /><path strokeLinecap="round" strokeLinejoin="round" d="M14 20h.01M20 14h.01M20 20h.01" /></svg>;
}
function IconDatabase({ className = 'w-6 h-6' }: { className?: string }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" /></svg>;
}
function IconFacebook({ className = 'w-6 h-6' }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" /></svg>;
}

function IconShield({ className = 'w-6 h-6' }: { className?: string }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>;
}
function IconBack({ className = 'w-5 h-5' }: { className?: string }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>;
}
function IconCheck({ className = 'w-3.5 h-3.5' }: { className?: string }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>;
}
function IconKey({ className = 'w-5 h-5' }: { className?: string }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" /></svg>;
}
function IconGithub({ className = 'w-5 h-5' }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z"/></svg>;
}
function IconGlobe({ className = 'w-6 h-6' }: { className?: string }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" /></svg>;
}

function WhatsAppIcon({ className = 'w-6 h-6' }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" /></svg>;
}

// ─── Toggle Switch ──────────────────────────────────────────────────
function Toggle({ enabled, onChange }: { enabled: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      onClick={() => onChange(!enabled)}
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900 ${
        enabled ? 'bg-emerald-500' : 'bg-gray-700'
      }`}
    >
      <span
        className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-lg ring-0 transition-transform duration-200 ease-in-out ${
          enabled ? 'translate-x-5' : 'translate-x-0'
        }`}
      />
    </button>
  );
}

// ─── PIN Login ───────────────────────────────────────────────────────
function PinLogin({ onLogin, toast }: { onLogin: () => void; toast: ReturnType<typeof useToast>['toast'] }) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    const valid = await verifyPin(pin);
    if (valid) {
      localStorage.setItem('safelink_auth', btoa(`safelink:${Date.now()}`));
      toast({ title: 'Welcome!', description: 'Logged in successfully' });
      onLogin();
    } else {
      setError('Wrong PIN');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gray-950">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-emerald-600/5 rounded-full blur-3xl" />
      </div>
      <div className="w-full max-w-md relative">
        <div className="bg-gray-900/80 backdrop-blur-xl rounded-2xl p-8 border border-gray-800 shadow-2xl shadow-black/50">
          <div className="flex flex-col items-center mb-8">
            <div className="w-14 h-14 bg-emerald-500/20 rounded-2xl flex items-center justify-center mb-4 ring-1 ring-emerald-500/30">
              <span className="text-emerald-400"><IconLock className="w-7 h-7" /></span>
            </div>
            <h1 className="text-xl font-bold text-white">SafeLink</h1>
            <p className="text-gray-500 text-xs mt-1.5">Enter PIN to continue</p>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <input
              type="password"
              value={pin}
              onChange={(e) => { setPin(e.target.value); setError(''); }}
              placeholder="Enter PIN"
              autoFocus
              inputMode="numeric"
              maxLength={10}
              className="w-full px-4 py-3.5 bg-gray-800/80 border border-gray-700 rounded-xl text-white text-center text-lg tracking-[0.3em] placeholder-gray-600 placeholder:text-sm placeholder:tracking-normal focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
            />
            {error && <p className="text-red-400 text-xs text-center">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 disabled:opacity-50 text-white font-semibold text-sm rounded-xl transition-colors cursor-pointer shadow-lg shadow-emerald-500/20"
            >
              {loading ? 'Verifying...' : 'Unlock'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

// ─── Redirect Page ───────────────────────────────────────────────────
// Fetch settings from Supabase (not localStorage) so all visitors get admin settings
function RedirectPage({ code, toast }: { code: string; toast: ReturnType<typeof useToast>['toast'] }) {
  const [link, setLink] = useState<ShortLinkData | null>(null);
  const [loading, setLoading] = useState(true);
  const [seconds, setSeconds] = useState(0);
  const [redirectTime, setRedirectTime] = useState(5);
  const [waShow, setWaShow] = useState(false);
  const [fbShow, setFbShow] = useState(false);
  const [waUrl, setWaUrl] = useState('');
  const [fbUrl, setFbUrl] = useState('');
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [linkLoaded, setLinkLoaded] = useState(false);
  const [article] = useState<ArticleData>(getRandomArticle);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Fetch settings from Supabase (not localStorage!)
  useEffect(() => {
    async function loadSettings() {
      try {
        const { data } = await supabase.from('settings').select('*');
        if (data) {
          data.forEach((row: { key: string; value: string }) => {
            switch (row.key) {
              case 'redirect_time': setRedirectTime(parseInt(row.value) || 5); break;
              case 'wa_channel_show': setWaShow(row.value === 'true'); break;
              case 'wa_channel_url': setWaUrl(row.value || ''); break;
              case 'fb_group_show': setFbShow(row.value === 'true'); break;
              case 'fb_group_url': setFbUrl(row.value || ''); break;
            }
          });
        }
      } catch { /* use defaults */ }
      setSettingsLoaded(true);
    }
    loadSettings();
  }, []);

  // Fetch the short link
  useEffect(() => {
    async function fetchLink() {
      try {
        const { data, error } = await supabase.from('short_links').select('*').eq('code', code).single();
        if (data) {
          setLink(data);
          const { data: current } = await supabase.from('short_links').select('clicks').eq('code', code).single();
          if (current) {
            await supabase.from('short_links').update({ clicks: (current.clicks || 0) + 1 }).eq('code', code);
          }
        } else {
          toast({ title: 'Not Found', description: error?.message || 'Link not found', variant: 'destructive' });
        }
      } catch (err) {
        toast({ title: 'Error', description: String(err), variant: 'destructive' });
      }
      setLinkLoaded(true);
    }
    fetchLink();
  }, [code, toast]);

  // Only start countdown when BOTH link and settings are loaded
  useEffect(() => {
    if (link && seconds === 0 && settingsLoaded && linkLoaded) {
      setSeconds(redirectTime);
    }
  }, [link, redirectTime, seconds, settingsLoaded, linkLoaded]);

  useEffect(() => {
    if (seconds > 0 && link) {
      timerRef.current = setInterval(() => {
        setSeconds((prev) => {
          if (prev <= 1) {
            if (timerRef.current) clearInterval(timerRef.current);
            window.location.href = link.url;
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => { if (timerRef.current) clearInterval(timerRef.current); };
    }
  }, [seconds, link]);

  const allLoaded = settingsLoaded && linkLoaded;

  const hasCta = (waShow && waUrl) || (fbShow && fbUrl);

  if (!allLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-950">
        <div className="w-16 h-16 border-4 border-gray-700 border-t-emerald-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (!link) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gray-950">
        <div className="text-center bg-gray-900 rounded-2xl p-10 border border-gray-800 max-w-md">
          <div className="w-[4.5rem] h-[4.5rem] bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-5">
            <svg className="w-10 h-10 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </div>
          <h2 className="text-xl font-bold text-white mb-3">Link Not Found</h2>
          <p className="text-gray-500 text-base">The shortlink does not exist or has been removed.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen bg-gray-950 ${hasCta ? 'pb-36' : 'pb-8'}`}>
      <div className="max-w-3xl mx-auto p-5 pt-8">
        <div className="bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden">
          <div className="p-5 sm:p-6 pb-0">
            <div className="flex flex-wrap items-center gap-2.5 text-xs text-gray-500 mb-3">
              <span className="bg-emerald-500/10 text-emerald-400 px-3 py-1 rounded-full font-semibold">{article.category.toUpperCase()}</span>
              <span>{article.publishDate}</span>
              <span className="text-gray-700">|</span>
              <span>{article.author}</span>
              <span className="text-gray-700">|</span>
              <span>{article.readTime}</span>
            </div>
            <h1 className="text-lg sm:text-2xl font-bold text-white leading-tight">{article.title}</h1>
          </div>
          <img src={`https://picsum.photos/800/400?${Date.now()}`} alt="Article" className="w-full mt-4" loading="eager" />
          <div className="p-5 sm:p-6">
            <p className="text-gray-400 text-sm sm:text-base italic mb-4">{article.metaDescription}</p>
            <div className="text-gray-300 text-base leading-relaxed space-y-4" dangerouslySetInnerHTML={{ __html: article.content }} />
          </div>
        </div>
        <div className="mt-6 text-center">
          <div className="inline-flex items-center gap-4 bg-gray-900 rounded-2xl px-8 py-5 border border-gray-800">
            <div className="w-12 h-12 border-3 border-gray-700 border-t-emerald-500 rounded-full animate-spin" style={{ borderWidth: '3px' }} />
            <div className="text-left">
              <p className="text-white text-base font-medium">Redirect in <span className="text-emerald-400 font-bold text-2xl ml-1">{seconds}</span></p>
              <p className="text-gray-600 text-sm truncate max-w-xs sm:max-w-sm">{link.url}</p>
            </div>
          </div>
        </div>
      </div>
      {hasCta && (
        <div className="fixed bottom-0 left-0 right-0 z-50 p-4 bg-gray-950/90 backdrop-blur-xl border-t border-gray-800">
          <div className="max-w-3xl mx-auto flex gap-3">
            {waShow && waUrl && (
              <a href={waUrl} target="_blank" rel="noopener noreferrer" className="flex-1 flex items-center justify-center gap-2.5 py-4 bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-white text-sm font-semibold rounded-xl transition-colors shadow-lg shadow-emerald-500/20">
                <WhatsAppIcon className="w-5 h-5" /> Join WhatsApp
              </a>
            )}
            {fbShow && fbUrl && (
              <a href={fbUrl} target="_blank" rel="noopener noreferrer" className="flex-1 flex items-center justify-center gap-2.5 py-4 bg-[#1877F2] hover:bg-[#166FE5] active:bg-[#1467D6] text-white text-sm font-semibold rounded-xl transition-colors shadow-lg shadow-[#1877F2]/20">
                <IconFacebook className="w-5 h-5" /> Join Facebook Group
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Home Tab ────────────────────────────────────────────────────────
function HomeTab({ links, onLoad, toast, customDomain }: { links: ShortLinkData[]; onLoad: () => void; toast: ReturnType<typeof useToast>['toast']; customDomain?: string }) {
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'clicks'>('newest');

  const totalLinks = links.length;
  const totalClicks = links.reduce((s, l) => s + l.clicks, 0);
  const avgClicks = totalLinks > 0 ? Math.round(totalClicks / totalLinks) : 0;

  const filteredLinks = useMemo(() => {
    let filtered = links;
    if (search.trim()) {
      const q = search.toLowerCase();
      filtered = filtered.filter((l) => l.code.toLowerCase().includes(q) || l.url.toLowerCase().includes(q));
    }
    switch (sortBy) {
      case 'newest': return [...filtered].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      case 'oldest': return [...filtered].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      case 'clicks': return [...filtered].sort((a, b) => b.clicks - a.clicks);
      default: return filtered;
    }
  }, [links, search, sortBy]);

  async function handleDelete(code: string) {
    try {
      const { error } = await supabase.from('short_links').delete().eq('code', code);
      if (!error) { toast({ title: 'Deleted' }); onLoad(); }
      else { toast({ title: 'Error', description: error.message, variant: 'destructive' }); }
    } catch (err) { toast({ title: 'Error', description: String(err), variant: 'destructive' }); }
  }

  async function handleClearAll() {
    if (!confirm('Delete all links?')) return;
    try {
      const { error } = await supabase.from('short_links').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      if (!error) { toast({ title: 'Cleared' }); onLoad(); }
      else { toast({ title: 'Error', description: error.message, variant: 'destructive' }); }
    } catch (err) { toast({ title: 'Error', description: String(err), variant: 'destructive' }); }
  }

  function handleExport() {
    if (links.length === 0) { toast({ title: 'No links to export', variant: 'destructive' }); return; }
    const csv = 'Code,URL,Clicks,Created At\n' + links.map(l => `"${l.code}","${l.url}",${l.clicks},"${formatCreatedAt(l.created_at)}"`).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `safelinks-export-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
    URL.revokeObjectURL(url);
    toast({ title: 'Exported!', description: `${links.length} links exported as CSV` });
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
        {[
          { label: 'Total Links', value: totalLinks, icon: <IconLink className="w-5 h-5" /> },
          { label: 'Total Clicks', value: totalClicks, icon: <IconChartBar className="w-5 h-5" /> },
          { label: 'Avg. Clicks', value: avgClicks, icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16 8v8m-4-5v5m-4-2v2m-2 4h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg> },
          { label: 'Top Clicks', value: links.length > 0 ? Math.max(...links.map(l => l.clicks)) : 0, icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg> },
        ].map(stat => (
          <div key={stat.label} className="bg-gray-900 rounded-2xl p-4 border border-gray-800 hover:border-gray-700 transition-colors">
            <div className="flex items-center justify-between mb-2">
              <div className="w-8 h-8 bg-emerald-500/10 rounded-lg flex items-center justify-center"><span className="text-emerald-400">{stat.icon}</span></div>
              <svg className="w-4 h-4 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
            </div>
            <div className="text-2xl font-bold text-white">{stat.value}</div>
            <div className="text-sm text-gray-500 mt-1">{stat.label}</div>
          </div>
        ))}
      </div>

      <div className="bg-gray-900 rounded-2xl border border-gray-800">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 px-5 pt-5 pb-3">
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            <IconDatabase className="w-4 h-4" /> Link History
            <span className="text-xs bg-gray-800 text-gray-400 px-2.5 py-1 rounded-full">{filteredLinks.length}</span>
          </h2>
          <div className="flex gap-2">
            {links.length > 0 && (
              <button onClick={handleExport} className="px-3 py-2 bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white text-xs font-medium rounded-lg transition-colors cursor-pointer flex items-center gap-1.5">
                <IconDownload className="w-3.5 h-3.5" /> Export
              </button>
            )}
            {links.length > 0 && (
              <button onClick={handleClearAll} className="px-3 py-2 bg-gray-800 hover:bg-red-500/20 text-gray-400 hover:text-red-400 text-xs font-medium rounded-lg transition-colors cursor-pointer flex items-center gap-1.5">
                <IconTrash className="w-3.5 h-3.5" /> Clear All
              </button>
            )}
          </div>
        </div>
        <div className="px-6 pb-4">
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600" />
              <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search links..." className="w-full pl-9 pr-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent" />
            </div>
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value as 'newest' | 'oldest' | 'clicks')} className="px-3 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer">
              <option value="newest">Newest</option>
              <option value="oldest">Oldest</option>
              <option value="clicks">Most Clicks</option>
            </select>
          </div>
        </div>
        {filteredLinks.length === 0 ? (
          <div className="px-6 pb-8 pt-2 text-center">
            <div className="w-16 h-16 bg-gray-800 rounded-2xl flex items-center justify-center mx-auto mb-4"><IconLink className="w-8 h-8 text-gray-700" /></div>
            <p className="text-gray-600 text-sm">{search ? 'No links match your search' : 'No links yet. Create your first shortlink!'}</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-800/50 max-h-[500px] overflow-y-auto px-6 pb-2">
            {filteredLinks.map(l => (
              <div key={l.code} className="py-3 group">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <code className="text-emerald-400 text-sm font-mono font-semibold shrink-0">{getDomain(customDomain)}{l.code}</code>
                    </div>
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-xs text-gray-700 shrink-0">→</span>
                      <span className="text-gray-500 text-sm truncate">{l.url}</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-gray-600">
                      <span>{l.clicks} clicks</span>
                      <span>{formatCreatedAt(l.created_at)}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                    <button onClick={() => copyText(getDomain(customDomain) + l.code, toast)} className="p-2 hover:bg-gray-800 rounded-lg transition-colors cursor-pointer text-gray-500 hover:text-white" title="Copy short link">
                      <IconCopy className="w-4 h-4" />
                    </button>
                    <button onClick={() => { window.open(`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(getDomain(customDomain) + l.code)}`, '_blank'); }} className="p-2 hover:bg-gray-800 rounded-lg transition-colors cursor-pointer text-gray-500 hover:text-white" title="QR Code">
                      <IconQrCode className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleDelete(l.code)} className="p-2 hover:bg-red-500/20 rounded-lg transition-colors cursor-pointer text-gray-500 hover:text-red-400" title="Delete">
                      <IconTrash className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Create Tab ──────────────────────────────────────────────────────
function CreateTab({ onLoad, toast, customDomain }: { onLoad: () => void; toast: ReturnType<typeof useToast>['toast']; customDomain?: string }) {
  const [mode, setMode] = useState<'single' | 'bulk'>('single');
  const [urlInput, setUrlInput] = useState('');
  const [bulkInput, setBulkInput] = useState('');
  const [results, setResults] = useState<ShortLinkData[]>([]);
  const [loading, setLoading] = useState(false);

  async function handleGenerate() {
    const url = urlInput.trim();
    if (!url) { toast({ title: 'Enter a URL', variant: 'destructive' }); return; }
    setLoading(true);
    try {
      const normalizedUrl = /^https?:\/\//i.test(url) ? url : `https://${url}`;
      let code = '';
      let unique = false;
      for (let attempt = 0; attempt < 10; attempt++) {
        code = Math.random().toString(36).substring(2, 7);
        const { data: exists } = await supabase.from('short_links').select('id').eq('code', code).single();
        if (!exists) { unique = true; break; }
      }
      if (unique) {
        const { data, error } = await supabase.from('short_links').insert({ code, url: normalizedUrl }).select().single();
        if (!error && data) {
          setResults([data]);
          setUrlInput('');
          toast({ title: 'Created!' });
          onLoad();
        } else {
          toast({ title: 'Gagal membuat link', description: error?.message || 'Unknown error', variant: 'destructive' });
        }
      } else {
        toast({ title: 'Error', description: 'Failed to generate unique code', variant: 'destructive' });
      }
    } catch (err) {
      toast({ title: 'Error', description: String(err), variant: 'destructive' });
    } finally { setLoading(false); }
  }

  async function handleBulk() {
    const lines = bulkInput.split('\n').filter((x) => x.trim());
    if (lines.length === 0) { toast({ title: 'Enter URLs', variant: 'destructive' }); return; }
    setLoading(true);
    try {
      const inserts = [];
      for (const rawUrl of lines) {
        const trimmedUrl = rawUrl.trim();
        if (!trimmedUrl) continue;
        const normalizedUrl = /^https?:\/\//i.test(trimmedUrl) ? trimmedUrl : `https://${trimmedUrl}`;
        let code = '';
        let unique = false;
        for (let attempt = 0; attempt < 10; attempt++) {
          code = Math.random().toString(36).substring(2, 7);
          const { data: exists } = await supabase.from('short_links').select('id').eq('code', code).single();
          if (!exists) { unique = true; break; }
        }
        if (unique) inserts.push({ code, url: normalizedUrl });
      }
      if (inserts.length > 0) {
        const { data, error } = await supabase.from('short_links').insert(inserts).select();
        if (!error && data) {
          setResults(data);
          setBulkInput('');
          toast({ title: `${data.length} links created!` });
          onLoad();
        } else {
          toast({ title: 'Gagal membuat link', description: error?.message || 'Unknown error', variant: 'destructive' });
        }
      } else {
        toast({ title: 'Error', description: 'Failed to create any links', variant: 'destructive' });
      }
    } catch (err) {
      toast({ title: 'Error', description: String(err), variant: 'destructive' });
    } finally { setLoading(false); }
  }

  return (
    <div className="space-y-5">
      <div className="bg-gray-900 rounded-2xl p-1.5 border border-gray-800 flex w-fit">
        <button onClick={() => { setMode('single'); setResults([]); }} className={`px-4 py-2 text-xs font-medium rounded-lg transition-all cursor-pointer ${mode === 'single' ? 'bg-emerald-500 text-white shadow-lg' : 'text-gray-500 hover:text-gray-300'}`}>Single Link</button>
        <button onClick={() => { setMode('bulk'); setResults([]); }} className={`px-4 py-2 text-xs font-medium rounded-lg transition-all cursor-pointer ${mode === 'bulk' ? 'bg-emerald-500 text-white shadow-lg' : 'text-gray-500 hover:text-gray-300'}`}>Bulk Links</button>
      </div>

      <div className="bg-gray-900 rounded-2xl p-5 border border-gray-800">
        {mode === 'single' ? (
          <div className="space-y-3">
            <input type="text" value={urlInput} onChange={(e) => setUrlInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleGenerate()} placeholder="Paste your URL here..." className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-xl text-white text-sm placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all" />
            <button onClick={handleGenerate} disabled={loading} className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 disabled:opacity-50 text-white font-semibold text-sm rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-2">
              {loading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><IconPlus /> Generate Link</>}
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <textarea value={bulkInput} onChange={(e) => setBulkInput(e.target.value)} placeholder={"One URL per line:\nhttps://example.com/page1\nhttps://example.com/page2\nhttps://example.com/page3"} rows={5} className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-xl text-white text-sm placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all resize-none" />
            <button onClick={handleBulk} disabled={loading} className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 disabled:opacity-50 text-white font-semibold text-sm rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-2">
              {loading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><IconPlus /> Generate Bulk Links</>}
            </button>
          </div>
        )}
      </div>

      {results.length > 0 && (
        <div className="bg-gray-900 rounded-2xl border border-gray-800">
          <div className="px-5 pt-5 pb-3">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <IconCheck className="w-4 h-4" /> Generated Links
            </h3>
          </div>
          <div className="divide-y divide-gray-800/50 px-5 pb-3">
            {results.map(l => (
              <div key={l.code} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span>{getRandomEmoji()}{getRandomEmoji()}</span>
                    <code className="text-emerald-400 text-sm font-mono font-semibold">{getDomain(customDomain)}{l.code}</code>
                  </div>
                  <p className="text-xs text-gray-600 mt-1 truncate">{l.url}</p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => copyText(`${getRandomEmoji()}${getRandomEmoji()} ${getDomain(customDomain)}${l.code}`, toast)} className="p-2 hover:bg-gray-800 rounded-lg transition-colors cursor-pointer text-gray-500 hover:text-white" title="Copy with emoji"><IconCopy className="w-4 h-4" /></button>
                  <button onClick={() => { window.open(`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(getDomain(customDomain) + l.code)}`, '_blank'); }} className="p-2 hover:bg-gray-800 rounded-lg transition-colors cursor-pointer text-gray-500 hover:text-white" title="QR"><IconQrCode className="w-4 h-4" /></button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Settings Tab ────────────────────────────────────────────────────
function SettingsTab({ toast, onSettingsChange }: { toast: ReturnType<typeof useToast>['toast']; onSettingsChange: (settings: SettingsData) => void }) {
  const [adminPin, setAdminPin] = useState('');
  const [redirectTime, setRedirectTime] = useState('5');
  const [waChannelShow, setWaChannelShow] = useState(false);
  const [waChannelUrl, setWaChannelUrl] = useState('');
  const [fbGroupShow, setFbGroupShow] = useState(false);
  const [fbGroupUrl, setFbGroupUrl] = useState('');
  const [customDomain, setCustomDomain] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const { data } = await supabase.from('settings').select('*');
        if (data) {
          data.forEach((row: { key: string; value: string }) => {
            switch (row.key) {
              case 'admin_pin': setAdminPin(row.value); break;
              case 'redirect_time': setRedirectTime(row.value); break;
              case 'wa_channel_show': setWaChannelShow(row.value === 'true'); break;
              case 'wa_channel_url': setWaChannelUrl(row.value); break;
              case 'fb_group_show': setFbGroupShow(row.value === 'true'); break;
              case 'fb_group_url': setFbGroupUrl(row.value); break;
              case 'custom_domain': setCustomDomain(row.value); break;
            }
          });
        }
      } catch { /* silent */ }
      setLoading(false);
    }
    load();
  }, []);

  async function handleSave() {
    setSaving(true);
    try {
      const upserts = [
        { key: 'admin_pin', value: adminPin },
        { key: 'redirect_time', value: redirectTime },
        { key: 'wa_channel_show', value: String(waChannelShow) },
        { key: 'wa_channel_url', value: waChannelUrl },
        { key: 'fb_group_show', value: String(fbGroupShow) },
        { key: 'fb_group_url', value: fbGroupUrl },
        { key: 'custom_domain', value: customDomain },
      ];
      const { error } = await supabase.from('settings').upsert(upserts, { onConflict: 'key' });
      if (!error) {
        toast({ title: 'Settings saved!' });
        onSettingsChange({ custom_domain: customDomain });
      } else {
        toast({ title: 'Error', description: error.message, variant: 'destructive' });
      }
    } catch (err) {
      toast({ title: 'Error', description: String(err), variant: 'destructive' });
    } finally { setSaving(false); }
  }

  async function handleReset() {
    if (!confirm('Reset all CTA and redirect settings to defaults? Your admin PIN will be kept.')) return;
    setResetting(true);
    try {
      const resetValues = [
        { key: 'redirect_time', value: '5' },
        { key: 'wa_channel_show', value: 'false' },
        { key: 'wa_channel_url', value: '' },
        { key: 'fb_group_show', value: 'false' },
        { key: 'fb_group_url', value: '' },
        { key: 'custom_domain', value: '' },
      ];
      const { error } = await supabase.from('settings').upsert(resetValues, { onConflict: 'key' });
      if (!error) {
        setRedirectTime('5');
        setWaChannelShow(false);
        setWaChannelUrl('');
        setFbGroupShow(false);
        setFbGroupUrl('');
        setCustomDomain('');
        onSettingsChange({ custom_domain: '' });
        toast({ title: 'Settings reset!', description: 'CTA settings restored to defaults' });
      } else {
        toast({ title: 'Error', description: error.message, variant: 'destructive' });
      }
    } catch (err) {
      toast({ title: 'Error', description: String(err), variant: 'destructive' });
    } finally { setResetting(false); }
  }

  if (loading) {
    return <div className="flex items-center justify-center py-20"><div className="w-10 h-10 border-3 border-gray-700 border-t-emerald-500 rounded-full animate-spin" style={{ borderWidth: '3px' }} /></div>;
  }

  const currentDefaultDomain = typeof window !== 'undefined' ? window.location.origin + window.location.pathname.replace(/\/$/, '') : '';

  return (
    <div className="space-y-6">
      {/* Security Card */}
      <div className="bg-gray-900 rounded-2xl p-5 border border-gray-800">
        <div className="flex items-center gap-3 mb-5">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-emerald-500/10 ring-1 ring-emerald-500/20">
            <IconShield className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white">Security</h2>
            <p className="text-xs text-gray-500 mt-0.5">PIN & redirect settings</p>
          </div>
        </div>
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <IconKey className="w-5 h-5 text-gray-500 shrink-0" />
            <span className="text-sm text-gray-400 w-28 shrink-0">Admin PIN</span>
            <input type="text" value={adminPin} onChange={(e) => setAdminPin(e.target.value)} placeholder="Enter login PIN" className="flex-1 min-w-0 px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent placeholder-gray-600 transition-all" />
          </div>
          <div className="flex items-center gap-3">
            <IconShield className="w-5 h-5 text-gray-500 shrink-0" />
            <span className="text-sm text-gray-400 w-28 shrink-0">Redirect</span>
            <select value={redirectTime} onChange={(e) => setRedirectTime(e.target.value)} className="flex-1 min-w-0 px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer transition-all">
              <option value="0">0s — instant redirect</option>
              <option value="1">1 second</option>
              <option value="2">2 seconds</option>
              <option value="3">3 seconds</option>
              <option value="5">5 seconds</option>
              <option value="10">10 seconds</option>
              <option value="15">15 seconds</option>
              <option value="20">20 seconds</option>
              <option value="30">30 seconds</option>
            </select>
          </div>
        </div>
      </div>

      {/* Domain Card */}
      <div className="bg-gray-900 rounded-2xl p-5 border border-gray-800">
        <div className="flex items-center gap-3 mb-5">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-teal-500/10 ring-1 ring-teal-500/20">
            <IconGlobe className="w-5 h-5 text-teal-400" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white">Domain</h2>
            <p className="text-xs text-gray-500 mt-0.5">Custom link prefix</p>
          </div>
        </div>
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-400 w-28 shrink-0">Custom URL</span>
            <input
              type="text"
              value={customDomain}
              onChange={(e) => setCustomDomain(e.target.value)}
              placeholder={currentDefaultDomain || 'xsafe.biz.id'}
              className="flex-1 min-w-0 px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent placeholder-gray-600 transition-all"
            />
          </div>
          {customDomain && (
            <div className="flex items-center gap-2 pl-[calc(7rem+0.75rem)]">
              <span className="text-xs text-gray-600">Preview:</span>
              <code className="text-xs text-emerald-400/80 font-mono bg-emerald-500/10 px-2.5 py-1 rounded-lg break-all">{ensureProtocol(customDomain)}/#abc123</code>
            </div>
          )}
        </div>
      </div>

      {/* Channels Card */}
      <div className="bg-gray-900 rounded-2xl p-5 border border-gray-800">
        <div className="flex items-center gap-3 mb-5">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-emerald-500/10 ring-1 ring-emerald-500/20">
            <IconChartBar className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white">Channels</h2>
            <p className="text-xs text-gray-500 mt-0.5">CTA buttons on redirect page</p>
          </div>
        </div>
        <div className="space-y-4">
          {/* WhatsApp */}
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <WhatsAppIcon className="w-5 h-5 text-gray-500 shrink-0" />
              <span className="text-sm text-gray-400 flex-1">WhatsApp Channel</span>
              <Toggle enabled={waChannelShow} onChange={setWaChannelShow} />
            </div>
            {waChannelShow && (
              <input type="url" value={waChannelUrl} onChange={(e) => setWaChannelUrl(e.target.value)} placeholder="https://whatsapp.com/channel/..." className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent placeholder-gray-600 transition-all" />
            )}
          </div>
          {/* Facebook */}
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <IconFacebook className="w-5 h-5 text-gray-500 shrink-0" />
              <span className="text-sm text-gray-400 flex-1">Facebook Group</span>
              <Toggle enabled={fbGroupShow} onChange={setFbGroupShow} />
            </div>
            {fbGroupShow && (
              <input type="url" value={fbGroupUrl} onChange={(e) => setFbGroupUrl(e.target.value)} placeholder="https://facebook.com/groups/..." className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent placeholder-gray-600 transition-all" />
            )}
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3">
        <button onClick={handleSave} disabled={saving} className="flex-1 py-3 bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 disabled:opacity-50 text-white font-semibold text-sm rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20">
          {saving ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><IconCheck className="w-4 h-4" /> Save Settings</>}
        </button>
        <button onClick={handleReset} disabled={resetting} className="py-3 px-6 bg-gray-800 hover:bg-gray-700 active:bg-gray-600 disabled:opacity-50 text-gray-400 hover:text-white font-medium text-sm rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-2 border border-gray-700">
          {resetting ? <div className="w-5 h-5 border-2 border-gray-500 border-t-gray-300 rounded-full animate-spin" /> : <><IconTrash className="w-4 h-4" /> Reset</>}
        </button>
      </div>
    </div>
  );
}

// ─── Dashboard ───────────────────────────────────────────────────────
function Dashboard({ toast }: { toast: ReturnType<typeof useToast>['toast'] }) {
  const [activeTab, setActiveTab] = useState<Tab>('home');
  const [links, setLinks] = useState<ShortLinkData[]>([]);
  const [loading, setLoading] = useState(true);
  const [customDomain, setCustomDomain] = useState<string | undefined>(undefined);

  const loadLinks = useCallback(async () => {
    try {
      const { data, error } = await supabase.from('short_links').select('*').order('created_at', { ascending: false });
      if (!error && data) setLinks(data);
      else if (error) console.error('Load links error:', error.message);
    } catch (err) { console.error('Load links error:', err); }
    setLoading(false);
  }, []);

  // Load custom domain from Supabase on mount
  useEffect(() => {
    async function loadSettings() {
      try {
        const { data } = await supabase.from('settings').select('value').eq('key', 'custom_domain').single();
        if (data && data.value) {
          setCustomDomain(data.value);
        }
      } catch { /* silent */ }
    }
    loadSettings();
  }, []);

  useEffect(() => { loadLinks(); }, [loadLinks]);

  const handleSettingsChange = useCallback((settings: SettingsData) => {
    setCustomDomain(settings.custom_domain || undefined);
  }, []);

  const handleLogout = useCallback(() => {
    localStorage.removeItem('safelink_auth');
    window.location.hash = '';
    window.location.reload();
  }, []);

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: 'home', label: 'Home', icon: <IconHome /> },
    { key: 'create', label: 'Create', icon: <IconPlus /> },
    { key: 'settings', label: 'Settings', icon: <IconCog /> },

  ];

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex flex-col w-64 bg-gray-900/50 border-r border-gray-800 p-4 fixed top-0 bottom-0 z-30">
        <div className="flex items-center gap-2.5 px-3 py-4 mb-6">
          <div className="w-8 h-8 bg-emerald-500/20 rounded-lg flex items-center justify-center ring-1 ring-emerald-500/30"><span className="text-emerald-400"><IconLink className="w-4 h-4" /></span></div>
          <span className="text-sm font-bold text-white">SafeLink</span>
        </div>
        <nav className="flex-1 space-y-1" role="navigation" aria-label="Dashboard navigation">
          {tabs.map(tab => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all cursor-pointer ${activeTab === tab.key ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' : 'text-gray-400 hover:text-white hover:bg-gray-800'}`}>
              {tab.icon} {tab.label}
            </button>
          ))}
        </nav>
        <button onClick={handleLogout} className="flex items-center gap-3 px-4 py-3 text-sm text-gray-500 hover:text-red-400 rounded-xl transition-colors cursor-pointer">
          <IconLogout /> Logout
        </button>
      </aside>

      {/* Mobile Header */}
      <header className="lg:hidden sticky top-0 z-30 bg-gray-950/90 backdrop-blur-xl border-b border-gray-800">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2"><span className="text-emerald-400"><IconLink className="w-4 h-4" /></span><span className="text-sm font-bold text-white">SafeLink</span></div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 lg:ml-64 p-4 lg:p-8 pb-24 lg:pb-8">
        {loading ? (
          <div className="flex items-center justify-center py-20"><div className="w-12 h-12 border-4 border-gray-700 border-t-emerald-500 rounded-full animate-spin" /></div>
        ) : (
          <>
            {activeTab === 'home' && <HomeTab links={links} onLoad={loadLinks} toast={toast} customDomain={customDomain} />}
            {activeTab === 'create' && <CreateTab onLoad={loadLinks} toast={toast} customDomain={customDomain} />}
            {activeTab === 'settings' && <SettingsTab toast={toast} onSettingsChange={handleSettingsChange} />}

          </>
        )}
      </main>

      {/* Mobile Bottom Nav */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-30 bg-gray-900/95 backdrop-blur-xl border-t border-gray-800" role="navigation" aria-label="Dashboard navigation">
        <div className="flex">
          {tabs.map(tab => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)} className={`flex-1 flex flex-col items-center gap-1 py-3 transition-colors cursor-pointer ${activeTab === tab.key ? 'text-emerald-400' : 'text-gray-500'}`}>
              {tab.icon} <span className="text-[10px] font-medium">{tab.label}</span>
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}

// ─── Home Page (minimal landing) ─────────────────────────────────────
function HomePage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-emerald-600/5 rounded-full blur-3xl" />
      </div>
      <div className="relative text-center">
        <div className="w-20 h-20 bg-emerald-500/20 rounded-2xl flex items-center justify-center mx-auto mb-6 ring-1 ring-emerald-500/30">
          <span className="text-emerald-400"><IconLink className="w-10 h-10" /></span>
        </div>
        <h1 className="text-4xl font-bold text-white mb-2">SafeLink</h1>
        <p className="text-gray-500 text-sm">Smart URL Shortener & Safelink</p>
      </div>
    </div>
  );
}

// ─── App Root ────────────────────────────────────────────────────────
export default function App() {
  const [isAuth, setIsAuth] = useState(false);
  const [checking, setChecking] = useState(true);
  const [hash, setHash] = useState('');
  const { toasts, toast, removeToast } = useToast();

  useEffect(() => {
    const auth = localStorage.getItem('safelink_auth');
    if (auth) setIsAuth(true);
    setChecking(false);
  }, []);

  // Listen for hash changes
  useEffect(() => {
    function handleHashChange() {
      setHash(window.location.hash);
    }
    setHash(window.location.hash);
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-950">
        <div className="w-12 h-12 border-4 border-gray-700 border-t-emerald-500 rounded-full animate-spin" />
      </div>
    );
  }

  const code = hash.replace(/^#\/?/, '');

  // No hash → Show minimal HomePage
  if (hash === '' || hash === '#') {
    return (
      <>
        <HomePage />
        <ToastContainer toasts={toasts} onRemove={removeToast} />
      </>
    );
  }

  // #admin → Show login or dashboard
  if (hash === '#admin') {
    if (!isAuth) {
      return (
        <>
          <PinLogin onLogin={() => setIsAuth(true)} toast={toast} />
          <ToastContainer toasts={toasts} onRemove={removeToast} />
        </>
      );
    }
    return (
      <>
        <Dashboard toast={toast} />
        <ToastContainer toasts={toasts} onRemove={removeToast} />
      </>
    );
  }

  // Any other hash (like #CODE) → Show RedirectPage
  if (code) {
    return (
      <>
        <RedirectPage code={code} toast={toast} />
        <ToastContainer toasts={toasts} onRemove={removeToast} />
      </>
    );
  }

  // Fallback to HomePage
  return (
    <>
      <HomePage />
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </>
  );
}
