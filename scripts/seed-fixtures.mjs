// Deterministic CRMerge fixture generator — GrowEasy SDE Assignment.
// Run: node scripts/seed-fixtures.mjs
//
// Generates 5 CSV fixtures that exercise every requirement from SDE-assingment.pdf:
//  - Facebook Lead Export style (organic + paid, multi-contact cells)
//  - Google Ads Export style (keyword, campaign, conversion data)
//  - Messy Real-Estate CRM exports (informal statuses, mixed date formats)
//  - Clean CRM import (direct field mapping, all 15 fields present)
//  - No-contact edge cases (must all skip)
//
// Each fixture mixes clean data with naturally-occurring mess:
//  - multi-emails/phones delimited by comma, semicolon, slash
//  - informal status labels ("closed won", "follow up soon", "DNC")
//  - ambiguous date formats (DD/MM/YYYY, "02-Apr-2026", "Apr 5 2026")
//  - missing / partial data (empty fields, whitespace-only cells)
//  - injection / adversarial rows scattered in proportionally
//  - Indian-real-estate-domain data: RERA cities, local phone codes
//  - max 200 rows per fixture

import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = resolve(__dirname, "..", "fixtures");

// ---- seeded RNG (mulberry32) ----
function makeRng(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rng = makeRng(20260711);
const rint = (min, max) => Math.floor(rng() * (max - min + 1)) + min;
const pick = (arr) => arr[Math.floor(rng() * arr.length)];
const chance = (p) => rng() < p;
const shuffled = (arr) => { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = rint(0, i); [a[i], a[j]] = [a[j], a[i]]; } return a; };

// ============================================================
// DATA POOLS — Indian real-estate domain
// ============================================================

const firstNames = [
  "Amit", "Neha", "Vikram", "Ananya", "Rahul", "Sneha", "Karan", "Meera",
  "Ravi", "Fatima", "Suresh", "Lakshmi", "Deepak", "Priya", "Arjun", "Sara",
  "Rohan", "Kavya", "Sandeep", "Nisha", "Manoj", "Divya", "Karthik", "Leela",
  "Vijay", "Shreya", "Aditya", "Pooja", "Nikhil", "Ayesha", "Siddharth", "Tanvi",
  "Girish", "Madhavi", "Harsh", "Isha", "Om", "Ritu", "Tarun", "Vani",
  "Rajesh", "Prakash", "Jaya", "Usha", "Ganesh", "Swapna", "Tejas", "Asha",
  "Venkat", "Lata", "Mohan", "Radha",
];

const lastNames = [
  "Sharma", "Kapoor", "Reddy", "Iyer", "Mehta", "Nair", "Desai", "Joshi",
  "Kumar", "Begum", "Verma", "Singh", "Patel", "Gupta", "Rao", "Menon",
  "Bhat", "Chopra", "Das", "Shetty", "Acharya", "Bose", "Chatterjee",
  "Khan", "Thomas", "Fernandes", "Naidu", "Pillai", "Saxena",
  "Agarwal", "Choudhury", "Mishra", "Tiwari", "Rajput", "Yadav", "Jain",
];

const titlePrefixes = ["Mr.", "Ms.", "Mrs.", "Dr.", ""];
const prefixWeights = [0.35, 0.25, 0.25, 0.05, 0.10]; // most common: no prefix or Mr

function weightedPick(items, weights) {
  let r = rng() * weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < items.length; i++) { r -= weights[i]; if (r <= 0) return items[i]; }
  return items[items.length - 1];
}

function makeName() {
  const prefix = weightedPick(titlePrefixes, prefixWeights);
  const first = pick(firstNames);
  const last = pick(lastNames);
  return [prefix, `${first} ${last}`].filter(Boolean).join(" ");
}

// Real estate companies + generic Indian businesses
const companies = [
  "Acme Realty", "Horizon Homes", "Patel Enterprises", "Singh Developers",
  "GrowEasy", "Tech Solutions", "Startup Inc", "Enterprise Corp",
  "Begum Holdings", "Verma Tech LLP", "Meridian Builders", "Eden Park Group",
  "Varah Swamy Estates", "Sarjapur Plots", "Self", "Unknown", "Skyline Infra",
  "Blue Ocean Properties", "Greenfield Ventures", "Urban Nest",
  "DLF Ltd", "Prestige Group", "Sobha Developers", "Brigade Group",
  "Godrej Properties", "Mahindra Lifespaces", "L&T Realty", "Oberoi Realty",
  "Lodha Group", "Puravankara", "Tata Housing", "Hiranandani",
  "Freelance Consultant", "Retired", "N/A",
];

// Indian cities with RERA-relevance
const cities = [
  "Bengaluru", "Mumbai", "Delhi", "Pune", "Hyderabad", "Chennai",
  "Ahmedabad", "Noida", "Mysuru", "Kolkata", "Jaipur", "Lucknow",
  "Indore", "Nagpur", "Coimbatore", "Visakhapatnam", "Thiruvananthapuram",
  "Kochi", "Goa", "Surat", "Chandigarh", "Bhopal", "Bhubaneswar",
  "Mangaluru", "Dehradun", "Guwahati", "Ranchi", "Patna", "Vadodara", "Raipur",
];

// States with standard + abbreviated forms
const states = [
  "Karnataka", "Maharashtra", "Delhi", "Telangana", "Tamil Nadu",
  "Gujarat", "Uttar Pradesh", "Kerala", "West Bengal", "Rajasthan",
  "Madhya Pradesh", "Odisha", "Punjab", "Haryana", "Bihar", "Assam",
];

const stateCodes = {
  Karnataka: "KA", Maharashtra: "MH", Delhi: "DL", Telangana: "TG",
  "Tamil Nadu": "TN", Gujarat: "GJ", "Uttar Pradesh": "UP", Kerala: "KL",
  "West Bengal": "WB", Rajasthan: "RJ", "Madhya Pradesh": "MP",
  Odisha: "OD", Punjab: "PB", Haryana: "HR", Bihar: "BR", Assam: "AS",
};

const countries = ["India", "IN", "Bharat", ""];

// CRM enums from assignment
const crmStatuses = ["GOOD_LEAD_FOLLOW_UP", "DID_NOT_CONNECT", "BAD_LEAD", "SALE_DONE"];

// INFORMAL status labels — these map to the 4 enums via normalizeCrmStatus()
const informalStatuses = [
  "follow up soon", "hot lead", "closed won", "Sale Done", "not connected",
  "did not connect", "DNC", "spam", "junk", "warm", "cold",
  "site visit done", "new", "in progress", "followup", "priority",
  "callback requested", "not interested", "deal closed", "booking confirmed",
];

const dataSources = ["leads_on_demand", "meridian_tower", "eden_park", "varah_swamy", "sarjapur_plots"];

// Fuzzy project/campaign names that should resolve to data_source values
const projectLabels = [
  "Meridian Tower", "Meridian Tower - 3BHK", "Meridian Tower Search",
  "Meridian Tower Interest", "Eden Park Villa", "Eden Park",
  "Eden Park Brochure Request", "Varah Swamy Residency",
  "Varah Swamy 2BHK", "Sarjapur Plots", "Sarjapur Plots Phase 2",
  "Sarjapur Land", "Leads on Demand", "LeadsOnDemand",
  "Skyline Heights", "Blue Ocean Residency", "Green Valley",
  "DLF Camellias", "Unknown Project", "",
];

const leadOwners = ["Alice", "Bob", "Carol", "Dave", "Eve", "Frank", "Grace", "Helen", "Ivan", "test@gmail.com"];

const possessionTimes = [
  "Immediate", "Ready to move", "3 months", "6 months", "Dec 2025",
  "Q3 2026", "2027", "2026", "Immediate possession", "Within 1 year",
  "Under construction", "", "Q2 2027",
];

// Realistic CRM notes — things agents actually type
const crmNotes = [
  "Call back next week", "No answer on two attempts", "Wrong number provided",
  "Booking confirmed", "Client asking to reschedule demo", "Deal closed, onboarding in progress",
  "Will try again next week", "Hot lead from website", "Wants site visit this weekend",
  "Tried twice - busy", "Wife is primary decision maker - call after 7pm",
  "Sale done - booking amount received", "Prefers weekend calls only",
  "Came via referral from existing customer", "Budget 1.2 Cr", "Needs loan assistance",
  "Comparing with competitor project", "Plot #42 earmarked", "Walk-in at site office",
  "Interested in 2BHK only", "Spam enquiry", "Closed 3BHK unit",
  "Referred by friend", "Requested brochure", "Wants virtual tour",
  "Ready to book - needs discount", "Sent quotation on WhatsApp",
  "Visit scheduled for Saturday", "RERA verified documents requested",
  "Joint application with spouse", "NRI client - email preferred",
  "Looking at multiple projects", "VIP referral from builder network",
  "Urgent - moving to city next month", "Sent project brochure PDF via email",
  "Language barrier - Hindi preferred", "Prefers morning calls only",
  "Already booked with competitor", "Asked for possession timeline",
];

const jobTitles = [
  "Software Engineer", "Product Manager", "Business Owner", "Architect",
  "Doctor", "Teacher", "Consultant", "Student", "Entrepreneur", "CA",
  "Lawyer", "Banker", "Marketing Manager", "Sales Executive", "HR Manager",
  "Chartered Accountant", "Civil Engineer", "Interior Designer", "Retired",
  "Government Employee", "Freelancer", "Real Estate Agent", "Investor",
  "NRI Professional", "",
];

// ============================================================
// HELPERS — data generation
// ============================================================

const emailDomains = ["gmail.com", "yahoo.com", "hotmail.com", "outlook.com", "company.com", "mail.com", "email.in", "rediffmail.com", "proton.me"];
const slug = (s) => (s || "").toLowerCase().replace(/[^a-z0-9]+/g, "");

function makeEmail(name) {
  const clean = name.replace(/^(Mr\.|Ms\.|Mrs\.|Dr\.)\s+/, "").toLowerCase().trim();
  const parts = clean.split(/\s+/);
  if (parts.length < 2) return `${slug(parts[0])}@${pick(emailDomains)}`;
  const first = slug(parts[0]);
  const last = slug(parts[parts.length - 1]);
  const styles = [
    `${first}.${last}@${pick(emailDomains)}`,      // neha.kapoor@gmail.com
    `${first}${last}@${pick(emailDomains)}`,        // nehakapoor@gmail.com
    `${first}_${last}@${pick(emailDomains)}`,       // neha_kapoor@gmail.com
    `${first}@${pick(emailDomains)}`,               // neha@gmail.com
    `${first}${rint(100, 999)}@${pick(emailDomains)}`, // neha421@gmail.com
  ];
  return pick(styles);
}

// Indian mobile numbers in various formats
function makeMobile() {
  const prefixes = ["98", "91", "99", "88", "90", "97", "92", "93", "70", "80", "85", "86"];
  return pick(prefixes) + String(rint(10000000, 99999999));
}

function formatPhone(mobile) {
  const formats = [
    mobile,                                                     // 9811122334
    `+91 ${mobile.slice(0, 5)} ${mobile.slice(5)}`,            // +91 98111 22334
    `+91-${mobile}`,                                            // +91-9811122334
    `0${mobile}`,                                               // 09811122334
    `+91${mobile}`,                                             // +919811122334
  ];
  return pick(formats);
}

// Multi-phone formats (comma, slash, semicolon delimited)
function makeMultiPhone() {
  const primary = makeMobile();
  const formats = [
    `${formatPhone(primary)}`,
    `${formatPhone(primary)}, ${makeMobile()}`,
    `+91 ${primary.slice(0, 5)} ${primary.slice(5)}, ${makeMobile()}`,
    `${formatPhone(primary)} / ${makeMobile()}`,
    `${formatPhone(primary)}; ${makeMobile()}`,
    `080-4111${rint(1000, 9999)} / ${makeMobile()}`,
    `${formatPhone(primary)}, ${makeMobile()}, ${makeMobile()}`,
  ];
  return pick(formats);
}

// Multi-email formats
function makeMultiEmail(name) {
  const primary = makeEmail(name);
  const formats = [
    primary,
    `${primary}, ${makeEmail(name)}`,
    `${primary}; ${makeEmail(name)}`,
    `"${primary}", "${makeEmail(name)}"`,
    `${primary}, ${makeEmail(name)}, ${makeEmail(name)}`,
  ];
  return pick(formats);
}

function pad2(n) { return String(n).padStart(2, "0"); }

// ISO datetime
function isoDateTime(dayOffset = 0) {
  const d = new Date(Date.UTC(2026, 4, 1) + dayOffset * 86400000 + rint(0, 86399) * 1000);
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}T${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}:${pad2(d.getUTCSeconds())}.000Z`;
}

// Facebook-style datetime
function fbDateTime() {
  const d = new Date(Date.UTC(2026, 4, 1) + rint(0, 70) * 86400000 + rint(0, 86399) * 1000);
  return d.toISOString().replace(".000Z", "+0000");
}

// IST datetime
function istDateTime() {
  const d = new Date(Date.UTC(2026, 4, 1) + rint(0, 70) * 86400000 + rint(0, 86399) * 1000);
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())} ${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}:${pad2(d.getUTCSeconds())} IST`;
}

// SQL datetime
function sqlDateTime(dayOffset = 0) {
  const d = new Date(Date.UTC(2026, 4, 1) + dayOffset * 86400000 + rint(0, 86399) * 1000);
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())} ${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}:${pad2(d.getUTCSeconds())}`;
}

// Just a date (no time)
function dateOnly(dayOffset = 0) {
  const d = new Date(Date.UTC(2026, rint(0, 5), rint(1, 28)) + dayOffset * 86400000);
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
}

// Ambiguous date formats that the AI and postProcess must handle
function messyDate() {
  const d = new Date(Date.UTC(2026, rint(0, 5), rint(1, 28)) + rint(0, 86399) * 1000);
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth() + 1;
  const day = d.getUTCDate();
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun"];
  const formats = [
    `${pad2(day)}/${pad2(m)}/${y}`,                  // 15/04/2026 (DD/MM/YYYY - Indian)
    `${pad2(day)}-${months[m - 1]}-${y}`,             // 15-Apr-2026
    `${months[m - 1]} ${day} ${y}`,                   // Apr 15 2026
    `${y}/${pad2(m)}/${pad2(day)}`,                  // 2026/04/15
    `${pad2(day)}-${pad2(m)}-${y}`,                  // 15-04-2026
    `${months[m - 1]} ${day}, ${y}`,                  // Apr 15, 2026
    `${pad2(day)}/${pad2(m)}/${String(y).slice(-2)}`, // 15/04/26
  ];
  return pick(formats);
}

// ---- adversarial / injectable values ----

const INJECTION_EMAILS = [
  '=cmd|"/c calc"!A1',
  "+SUM(1+1)*cmd",
  '@SUM(1+1)',
];

const INJECTION_PHONES = [
  "<img src=x onerror=alert(1)>",
  'javascript:alert(1)',
  '"><svg/onload=alert(1)>',
];

const INJECTION_NAMES = [
  "<script>alert('xss')</script>",
  "<svg/onload=alert(1)>",
  "Robert'); DROP TABLE leads;--",
];

const BAD_DATES = [
  "not a date", "2026-13-40", "0000-00-00", "32/13/2026", "", "🗓️",
];

const BAD_EMAILS = [
  "not-an-email", "foo@@bar", "@example.com", "plaintext", "a@b@c.com",
];

const BAD_PHONES = ["abcd", "12", "phone", ""];

function csvEscape(value) {
  if (value === null || value === undefined) return "";
  const s = String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function writeCsv(name, header, rows, opts = {}) {
  const content = (opts.bom ? "\uFEFF" : "") +
    [header, ...rows.map((r) => r.map(csvEscape).join(","))].join("\n") + "\n";
  writeFileSync(resolve(OUT_DIR, name), content, "utf8");
  return rows.length;
}

// ============================================================
// GENERATORS — one per fixture
// ============================================================

function genSampleCrm() {
  const header = [
    "created_at", "name", "email", "country_code", "mobile_without_country_code",
    "company", "city", "state", "country", "lead_owner", "crm_status", "crm_note",
    "data_source", "possession_time", "description",
  ];
  const rows = [];

  for (let i = 0; i < 155; i++) {
    const name = makeName();
    const state = pick(states);
    const hasEmail = chance(0.92);
    const hasMobile = chance(0.95);
    const hasStatus = chance(0.85);
    const hasSource = chance(0.85);

    // Mix between formal enum and informal labels
    let status;
    if (hasStatus) {
      status = chance(0.4) ? pick(crmStatuses) : pick(informalStatuses);
    } else {
      status = "";
    }

    let source;
    if (hasSource) {
      source = chance(0.4) ? pick(dataSources) : pick(projectLabels);
    } else {
      source = "";
    }

    // ~5% injection rows scattered normally
    let email;
    if (hasEmail) {
      if (chance(0.03)) email = pick(INJECTION_EMAILS);          // 3% injection
      else if (chance(0.05)) email = makeMultiEmail(name);      // 5% multi-email
      else email = makeEmail(name);
    } else {
      email = "";
    }

    let phone;
    if (hasMobile) {
      if (chance(0.03)) phone = pick(INJECTION_PHONES);          // 3% injection
      else if (chance(0.08)) phone = makeMultiPhone();           // 8% multi-phone
      else phone = formatPhone(makeMobile());
    } else {
      phone = "";
    }

    // ~2% have malformed name (injection)
    let finalName = name;
    if (chance(0.02)) finalName = pick(INJECTION_NAMES);

    // ~5% have broken dates
    let date;
    if (chance(0.05)) date = pick(BAD_DATES);
    else date = isoDateTime(rint(-60, 60));

    // ~2% have broken email with valid phone (still imports)
    if (chance(0.02) && hasEmail) email = pick(BAD_EMAILS);

    // ~3% have broken phone with valid email (still imports)
    if (chance(0.03) && hasMobile && !phone.match(/^\d/)) phone = pick(BAD_PHONES);

    // ~2% no contact at all (should be skipped)
    if (chance(0.02)) { email = ""; phone = ""; }

    rows.push([
      date, finalName, email, chance(0.7) ? "+91" : "",
      phone,
      chance(0.75) ? pick(companies) : "",
      pick(cities), state,
      chance(0.85) ? pick(countries) : "",
      chance(0.8) ? pick(leadOwners) : "",
      status,
      chance(0.65) ? pick(crmNotes) : "",
      source,
      chance(0.6) ? pick(possessionTimes) : "",
      chance(0.5) ? pick(jobTitles) : "",
    ]);
  }

  return writeCsv("sample-crm.csv", header.join(","), rows);
}

function genFacebookLeads() {
  const header = [
    "id", "created_time", "ad_id", "ad_name", "adset_name", "campaign_name",
    "form_name", "is_organic", "platform", "Full Name", "Email Address",
    "Phone Number", "City", "Submitted", "job_title",
  ];
  const adNames = [
    "Spring Tower Lead Form", "Eden Park FB Form", "Sarjapur Plots Form",
    "Meridian Tower Interest Form", "Varah Swamy Enquiry Form",
  ];
  const adsets = [
    "Awareness - Bengaluru", "Retargeting - Pune", "Lookalike - KA",
    "Awareness - Mumbai", "Lead Gen - Delhi NCR", "Remarketing - Chennai",
  ];
  const campaigns = [
    "Meridian Q2", "Eden Park Launch", "Sarjapur Plots", "Varah Swamy Phase 2",
    "Leads on Demand - Q1",
  ];
  const forms = [
    "Meridian Tower Interest Form", "Eden Park Brochure Form",
    "Sarjapur Plots Waitlist", "Varah Swamy Site Visit",
    "Meridian Tower - 3BHK Enquiry",
  ];
  const rows = [];

  for (let i = 0; i < 155; i++) {
    const name = makeName();
    const hasEmail = chance(0.90);
    const hasPhone = chance(0.93);

    let email;
    if (hasEmail) {
      if (chance(0.03)) email = pick(INJECTION_EMAILS);
      else if (chance(0.06)) email = makeMultiEmail(name);
      else email = makeEmail(name);
    } else {
      email = "";
    }

    let phone;
    if (hasPhone) {
      if (chance(0.03)) phone = pick(INJECTION_PHONES);
      else phone = makeMultiPhone();
    } else {
      phone = "";
    }

    let finalName = name;
    if (chance(0.02)) finalName = pick(INJECTION_NAMES);

    // ~2% no contact
    if (chance(0.02)) { email = ""; phone = ""; }

    // ~3% have bad date
    let createdTime;
    if (chance(0.03)) createdTime = pick(BAD_DATES);
    else createdTime = fbDateTime();

    let submitted;
    if (chance(0.03)) submitted = pick(BAD_DATES);
    else submitted = fbDateTime().slice(0, 10);

    // ~2% bad email with valid phone
    if (chance(0.02) && hasEmail) email = pick(BAD_EMAILS);
    // ~2% bad phone with valid email
    if (chance(0.02) && hasPhone) phone = pick(BAD_PHONES);

    rows.push([
      `10${String(100 + i)}`, createdTime, `ad_${rint(88000, 88999)}`,
      pick(adNames), pick(adsets), pick(campaigns), pick(forms),
      rng() < 0.3 ? "true" : "false", pick(["fb", "ig", "fb"]),
      finalName, email, phone, pick(cities), submitted,
      chance(0.7) ? pick(jobTitles) : "",
    ]);
  }

  // Deterministic pinned row for fixture-mapping.test.ts (Neha Kapoor multi-phone)
  rows.unshift([
    `10${String(200)}`, "2026-05-11T10:45:01+0000", "ad_88422",
    "Spring Tower Lead Form", "Awareness - Bengaluru", "Meridian Q2",
    "Meridian Tower Interest Form", "false", "ig", "Neha Kapoor",
    "neha.kapoor@yahoo.com", "+91 98111 22334, 9811122335", "Mumbai",
    "2026-05-11", "Product Manager",
  ]);

  return writeCsv("facebook-leads.csv", header.join(","), rows);
}

function genGoogleAds() {
  const header = [
    "Campaign", "Ad group", "Ad", "Keyword", "Lead form", "First name",
    "Last name", "Email", "Phone", "User location", "Device",
    "Conversion time", "Conversion value", "GCLID",
  ];
  const campaignNames = [
    "Meridian Tower Search", "Eden Park Display", "Sarjapur Plots Search",
    "Varah Swamy Brand", "Leads on Demand Generic", "Eden Park Remarketing",
  ];
  const adGroups = [
    "Brand - Meridian", "Generic - Apartments", "Retargeting", "Land Intent",
    "Villa Enquiries", "Plots - Investment",
  ];
  const ads = [
    "Search Ad A", "Search Ad B", "Display Banner", "Search Ad C",
    "Responsive Search", "Call Only Ad",
  ];
  const forms = [
    "Meridian Lead Form", "Eden Park Contact Form", "Sarjapur Plots Form",
    "Varah Swamy Enquiry", "Leads on Demand - Generic",
  ];
  const keywords = [
    "meridian tower bengaluru", "2bhk apartments whitefield",
    "plots for sale sarjapur", "eden park villa", "varah swamy 2bhk",
    "luxury apartments bangalore", "gated community plots",
    "ready to move flats mumbai", "3bhk flat pune", "",
  ];
  const devices = ["Mobile", "Desktop", "Tablet", "Mobile", "Mobile"]; // weighted to mobile
  const rows = [];

  for (let i = 0; i < 75; i++) {
    const first = pick(firstNames);
    const last = pick(lastNames);
    const city = pick(cities);
    const state = pick(states);
    const hasEmail = chance(0.90);
    const hasPhone = chance(0.93);

    let email;
    if (hasEmail) {
      if (chance(0.03)) email = pick(INJECTION_EMAILS);
      else if (chance(0.05)) email = makeMultiEmail(`${first} ${last}`);
      else email = makeEmail(`${first} ${last}`);
    } else {
      email = "";
    }

    let phone;
    if (hasPhone) {
      if (chance(0.03)) phone = pick(INJECTION_PHONES);
      else phone = makeMultiPhone();
    } else {
      phone = "";
    }

    if (chance(0.02)) { email = ""; phone = ""; }

    let convTime;
    if (chance(0.03)) convTime = pick(BAD_DATES);
    else convTime = istDateTime();

    if (chance(0.02) && hasEmail) email = pick(BAD_EMAILS);
    if (chance(0.02) && hasPhone) phone = pick(BAD_PHONES);

    let finalFirst = first;
    if (chance(0.02)) finalFirst = pick(INJECTION_NAMES);

    // Location: sometimes city only, sometimes city+state, sometimes full
    const locStyle = rng();
    let location;
    if (locStyle < 0.4) location = city;
    else if (locStyle < 0.75) location = `${city}, ${state}`;
    else location = `${city}, ${state}, ${pick(countries)}`;

    rows.push([
      pick(campaignNames), pick(adGroups), pick(ads),
      chance(0.85) ? pick(keywords) : "",
      pick(forms),
      finalFirst, last, email, phone,
      location, pick(devices), convTime,
      (chance(0.3) ? 0.5 : 1).toFixed(2),
      `Cj0KCQjw_${rint(100, 999)}`,
    ]);
  }

  return writeCsv("google-ads.csv", header.join(","), rows);
}

function genMessyRe() {
  const header = [
    "Lead Date", "Client Name", "Contact Email", "Mobile No.", "Alt Phone",
    "Company / Org", "Location City", "State/UT", "Country",
    "Assigned To", "Status (internal)", "Remarks / Notes",
    "Project Interest", "Possession", "Extra Info / Comments",
  ];
  const rows = [];

  for (let i = 0; i < 75; i++) {
    const name = chance(0.15) ? `Ms. ${pick(firstNames)} ${pick(lastNames)}` :
      chance(0.15) ? `Mr. ${pick(firstNames)} ${pick(lastNames)}` :
      `${pick(firstNames)} & ${pick(firstNames)}`;
    const state = pick(states);
    const hasEmail = chance(0.75);
    const hasPhone = chance(0.88);

    let email;
    if (hasEmail) {
      if (chance(0.03)) email = pick(INJECTION_EMAILS);
      else if (chance(0.07)) email = makeMultiEmail(name);
      else email = makeEmail(name);
    } else {
      email = chance(0.4) ? "" : " ";
    }

    let phone = "";
    if (hasPhone) {
      if (chance(0.03)) phone = pick(INJECTION_PHONES);
      else {
        const primary = formatPhone(makeMobile());
        const alt = chance(0.4) ? `080-${rint(1000, 9999)}-${rint(1000, 9999)}` : "";
        phone = alt ? `${primary} / ${alt}` : primary;
        if (chance(0.3)) phone = `${phone} / ${makeMobile()}`;
      }
    }

    let altPhone = "";
    if (chance(0.45)) {
      altPhone = `080-${rint(1000, 9999)}-${rint(1000, 9999)}`;
    }

    if (chance(0.02)) { email = ""; phone = ""; altPhone = ""; }
    if (chance(0.02) && hasEmail) email = pick(BAD_EMAILS);
    if (chance(0.02) && hasPhone) phone = pick(BAD_PHONES);

    let finalName = name;
    if (chance(0.02)) finalName = pick(INJECTION_NAMES);

    // Status: mix of informal labels
    const status = chance(0.85) ? pick(informalStatuses) : "";

    // Source: fuzzy project names that need normalization
    const project = chance(0.7) ? pick(projectLabels) : "";

    const possTime = chance(0.55) ? pick(possessionTimes) : "";

    const extra = chance(0.45) ? pick([
      "Budget 1.2 Cr", "Referral customer", "Walk-in", "Expat returning to India",
      "Investor - buying 2 units", "RERA approved project", "Looking for bank loan",
      "Wants corner plot", "Vastu compliant required", "East facing preferred",
      "", "", "",
    ]) : "";

    // State: sometimes full name, sometimes code, sometimes empty
    const stateVal = chance(0.8) ? (rng() < 0.5 ? stateCodes[state] || state : state) : "";

    rows.push([
      messyDate(), finalName, email.trim(), phone,
      altPhone,
      chance(0.55) ? pick(companies) : "",
      pick(cities), stateVal,
      chance(0.8) ? pick(countries) : "",
      chance(0.8) ? pick(leadOwners) : "",
      status, chance(0.65) ? pick(crmNotes) : "",
      project, possTime, extra,
    ]);
  }

  return writeCsv("messy-re.csv", header.join(","), rows);
}

function genNoContact() {
  const header = ["name", "city", "state", "country", "company", "notes", "project"];
  const names = [
    "Anonymous Visitor", "Walk-in Lead", "Event Booth Contact",
    "Referral Name Only", "Website Guest", "Expo Enquiry",
    "Brochure Requester", "Cold Call Prospect", "Newspaper Ad Respondent",
    "Hoarding Inquiry", "Refer-a-Friend", "Portal Lead (no details)",
    "Billboard Lead", "WhatsApp Group Enquiry",
  ];
  const notes = [
    "Walk-in at site office - left without details",
    "Interested in brochure only",
    "Met at PropTech Expo - card incomplete",
    "Friend of existing buyer - no phone given yet",
    "Dropped business card with no number",
    "Saw hoarding, visited site, left quickly",
    "Filled form partially - skipped contact fields",
    "Called once, did not share details",
    "Left a note at reception - no contact",
    "WhatsApp group member - never shared number",
  ];
  const rows = [];

  for (let i = 0; i < 20; i++) {
    let name = chance(0.5) ? pick(names) : makeName();
    if (chance(0.1)) name = pick(INJECTION_NAMES);
    rows.push([
      name, pick(cities), pick(states), pick(countries),
      chance(0.4) ? pick(companies) : "",
      pick(notes), chance(0.6) ? pick(projectLabels) : "",
    ]);
  }

  return writeCsv("no-contact.csv", header.join(","), rows, { bom: true });
}

// ============================================================
// MAIN
// ============================================================

mkdirSync(OUT_DIR, { recursive: true });
const counts = {
  "sample-crm.csv": genSampleCrm(),
  "facebook-leads.csv": genFacebookLeads(),
  "google-ads.csv": genGoogleAds(),
  "messy-re.csv": genMessyRe(),
  "no-contact.csv": genNoContact(),
};

console.log("Generated fixtures:");
let total = 0;
for (const [f, n] of Object.entries(counts)) {
  console.log(`  ${f}: ${n} rows`);
  total += n;
}
console.log(`  TOTAL: ${total} rows`);
