const { parseBankSMS } = require('../../src/lib/smsParser');
const { detectSubscriptionLeaks } = require('../../src/lib/behavioralEngine');

console.log("--- Final Verification ---");

// 1. Naming & Title Case
const sms1 = "HDFC Bank debited for Rs 200 at SWIGGY-INDIA-PVT-LTD. Ref: 123";
const p1 = parseBankSMS(sms1, Date.now());
console.log(`Input: SWIGGY-INDIA-PVT-LTD`);
console.log(`Output: ${p1.merchant}`); // Expected: Swiggy

const sms2 = "ICICI Bank: ₹550.00 spent at ZOMATO*HYDERABAD. UPI: 999";
const p2 = parseBankSMS(sms2, Date.now());
console.log(`Input: ZOMATO*HYDERABAD`);
console.log(`Output: ${p2.merchant}`); // Expected: Zomato

// 2. Subscription Cycle
const day = 24 * 60 * 60 * 1000;
const now = Date.now();
const txns = [
    { merchant: 'Netflix', amount: 499, date: new Date(now - 30 * day), type: 'debit' },
    { merchant: 'Netflix', amount: 499, date: new Date(now), type: 'debit' },
    { merchant: 'Netflix', amount: 499, date: new Date(now + 30 * day), type: 'debit' } // For testing predict next
];

const subResults = detectSubscriptionLeaks(txns);
const netflix = subResults.knownSubscriptions.find(s => s.merchant === 'Netflix');
if (netflix) {
    console.log(`\nSubscription: ${netflix.merchant}`);
    console.log(`Cycle: ${netflix.billingCycle}`); // Expected: monthly
    console.log(`Confidence: ${netflix.confidence}`); // Expected: high
}

console.log("\n--- Verification Complete ---");
