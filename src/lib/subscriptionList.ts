// A comprehensive list of known digital/software subscription services.
// We match using UPPERCASE keywords so "Netflix" matches "NETFLIX INDIA".
export const KNOWN_SUBSCRIPTIONS = new Set<string>([
  // Streaming & Entertainment
  'NETFLIX', 'DISNEY', 'HOTSTAR', 'SONYLIV', 'SONY LIV', 'ZEE5', 'JIOCINEMA', 'JIO CINEMA',
  'HBO MAX', 'HULU', 'PRIME VIDEO', 'AMAZON PRIME', 'APPLE TV', 'SPOTIFY', 'JIO SAAVN',
  'JIOSAAVN', 'GAANA', 'WYNK', 'YOUTUBE PREMIUM', 'YOUTUBE MUSIC', 'AUDIBLE', 'CRUNCHYROLL',
  'LIONSGATE', 'DISCOVERY+', 'AHAMOVIES', 'ALTBALAJI', 'HOICHOI', 'SUN NXT',

  // AI & Productivity
  'OPENAI', 'CHATGPT', 'ANTHROPIC', 'CLAUDE', 'GEMINI', 'PERPLEXITY', 'MIDJOURNEY',
  'ELEVENLABS', 'NOTION', 'GRAMMARLY', 'CANVA', 'ADOBE', 'CREATIVE CLOUD', 'MICROSOFT 365',
  'MSFT', 'GOOGLE ONE', 'ICLOUD', 'APPLE.COM/BILL', 'APPLE STORAGE',

  // SaaS & Cloud
  'GOOGLE WORKSPACE', 'SALESFORCE', 'HUBSPOT', 'SLACK', 'ZOOM',
  'DROPBOX', 'BOX', 'ATLASSIAN', 'JIRA', 'CONFLUENCE', 'FIGMA', 'GITHUB', 'GITLAB',
  'LINEAR', 'MONDAY', 'CLICKUP', 'ASANA', 'TRELLO', 'AWS', 'AZURE', 'GOOGLE CLOUD',
  'DIGITALOCEAN', 'VERCEL', 'NETLIFY', 'RAILWAY', 'RENDER', 'MONGODB', 'SUPABASE', 'PLANETSCALE',

  // Finance, Business & Learning
  'QUICKBOOKS', 'XERO', 'FRESHBOOKS', 'ZOHO', 'STRIPE', 'CHARGEBEE',
  'COURSERA', 'UDEMY', 'MASTERCLASS', 'SKILLSHARE', 'DUOLINGO', 'BRILLIANT',
  'CODECADEMY', 'DATACAMP', 'LINKEDIN LEARNING', 'LINKEDIN PREMIUM',

  // Fitness, Dating & Apps
  'STRAVA', 'MYFITNESSPAL', 'CALM', 'HEADSPACE', 'FITBIT', 'PELOTON', 'CULT.FIT',
  'CULTFIT', 'PLAYO', 'TINDER', 'BUMBLE', 'DISCORD', 'SNAPCHAT', 'TELEGRAM', 'PATREON', 'SUBSTACK'
]);

// Explicit non-subscription keywords. These are repeat physical/transactional purchases, NOT digital subscriptions.
export const EXCLUDED_FROM_SUBSCRIPTIONS = new Set<string>([
  'SWIGGY', 'ZOMATO', 'BLINKIT', 'ZEPTO', 'INSTAMART', 'BIGBASKET', 'GROCERY', 'DMART',
  'UBER', 'OLA', 'RAPIDO', 'METRO', 'PETROL', 'FUEL', 'INDIAN OIL', 'HPCL', 'BPCL',
  'FLIPKART', 'MEESHO', 'NYKAA', 'MYNTRA', 'AJIO', 'RELIANCE', 'BAZAAR', 'STORE', 'SHOP',
  'CAFE', 'RESTAURANT', 'KITCHEN', 'DHABA', 'FOOD', 'HOTEL', 'SALON', 'SPA', 'BARBER',
  'AIRTEL', 'JIO', 'VODAFONE', 'IDEA', 'ELECTRICITY', 'RECHARGE', 'BILL', 'WATER', 'GAS',
  'BROADBAND', 'PAYTM', 'GPAY', 'PHONEPE', 'CRED', 'ATM', 'WITHDRAWAL', 'CASH'
]);

// Helper function to check if a merchant is a known subscription
export function isKnownSubscription(merchant: string): boolean {
  if (!merchant) return false;
  const m = merchant.toUpperCase();

  // Explicit exceptions that contain excluded words but ARE subscriptions (e.g. UBER ONE, AMAZON PRIME, JIO CINEMA)
  if (m.includes('UBER ONE') || m.includes('PRIME VIDEO') || m.includes('AMAZON PRIME') || m.includes('YOUTUBE PREMIUM')) {
    return true;
  }

  // Check if merchant contains any excluded keyword (food, rides, groceries, shopping, bills)
  for (const excluded of EXCLUDED_FROM_SUBSCRIPTIONS) {
    if (m.includes(excluded)) return false;
  }

  // Check if merchant matches known subscriptions
  for (const sub of KNOWN_SUBSCRIPTIONS) {
    if (m.includes(sub)) return true;
  }

  return false;
}
