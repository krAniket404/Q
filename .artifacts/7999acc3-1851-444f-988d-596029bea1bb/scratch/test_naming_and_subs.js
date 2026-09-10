const { parseBankSMS } = require('../../src/lib/smsParser');
const { detectSubscriptionLeaks } = require('../../src/lib/behavioralEngine');

// 1. Verify Naming Convention
console.log("--- Naming Convention Test ---");
const testSMS = "ICICI Bank debited for Rs 500 at UPI-SWIGGY-INDIA-PVT-LTD*. Ref: 123456";
const parsed = parseBankSMS(testSMS, Date.now());
console.log(`Original: UPI-SWIGGY-INDIA-PVT-LTD*`);
console.log(`Parsed Merchant: ${parsed.merchant}`); // Expected: Swiggy

// 2. Verify Subscription Intelligence
console.log("\n--- Subscription Intelligence Test ---");
const now = Date.now();
const day = 24 * 60 * 60 * 1000;
const mockTxns = [
    { id: '1', merchant: 'Netflix', amount: 499, type: 'debit', date: new Date(now - 30 * day) },
    { id: '2', merchant: 'Netflix', amount: 499, type: 'debit', date: new Date(now) },
    { id: '3', merchant: 'Random Store', amount: 200, type: 'debit', date: new Date(now - 2 * day) },
    { id: '4', merchant: 'Random Store', amount: 200, type: 'debit', date: new Date(now) },
];

const subs = detectSubscriptionLeaks(mockTxns);
const netflix = subs.knownSubscriptions.find(s => s.merchant.toLowerCase().includes('netflix'));
if (netflix) {
    console.log(`Detected: ${netflix.merchant}`);
    console.log(`Confidence: ${netflix.confidence}`); // Should be high/medium
    console.log(`Cycle: ${netflix.billingCycle}`); // Should be monthly
} else {
    console.log("Netflix not detected as subscription!");
}
