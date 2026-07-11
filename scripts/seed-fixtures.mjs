// Deterministic adversarial fixture generator for CRMerge.
// Run: node scripts/seed-fixtures.mjs
// Produces randomized, realistic CSV fixtures + a curated block of "bad" rows
// per fixture to exercise the importer's guardrails (injection, malformed
// dates/emails/phones, invalid enums, missing contacts, control chars, BOM).

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

// ---- data pools ----
const firstNames = [
  "Amit", "Neha", "Vikram", "Ananya", "Rahul", "Sneha", "Karan", "Meera",
  "Ravi", "Fatima", "Suresh", "Lakshmi", "Deepak", "Priya", "Arjun", "Sara",
  "Rohan", "Kavya", "Sandeep", "Nisha", "Manoj", "Divya", "Karthik", "Leela",
  "Vijay", "Shreya", "Aditya", "Pooja", "Nikhil", "Ayesha", "Siddharth", "Tanvi",
  "Girish", "Madhavi", "Harsh", "Isha", "Om", "Ritu", "Tarun", "Vani",
];
const lastNames = [
  "Sharma", "Kapoor", "Reddy", "Iyer", "Mehta", "Nair", "Desai", "Joshi",
  "Kumar", "Begum", "Verma", "Singh", "Patel", "Gupta", "Rao", "Menon",
  "Bhat", "Chopra", "Das", "Shetty", "Acharya", "Bose", "Chatterjee",
  "Khan", "Thomas", "Fernandes", "Naidu", "Pillai", "Saxena",
];
const titlePrefixes = ["Mr.", "Ms.", "Mrs.", "Dr.", ""];

const companies = [
  "Acme Realty", "Horizon Homes", "Patel Enterprises", "Singh Developers",
  "GrowEasy", "Tech Solutions", "Startup Inc", "Enterprise Corp",
  "Begum Holdings", "Verma Tech LLP", "Meridian Builders", "Eden Park Group",
  "Varah Swamy Estates", "Sarjapur Plots", "Self", "Unknown", "Skyline Infra",
  "Blue Ocean Properties", "Greenfield Ventures", "Urban Nest",
];

const cities = [
  "Bengaluru", "Mumbai", "Delhi", "Pune", "Hyderabad", "Chennai", "Ahmedabad",
  "Noida", "Mysuru", "Kolkata", "Jaipur", "Lucknow", "Indore", "Nagpur",
  "Coimbatore", "Visakhapatnam", "Thiruvananthapuram", "Kochi", "Goa", "Surat",
];
const states = [
  "Karnataka", "Maharashtra", "Delhi", "Telangana", "Tamil Nadu", "Gujarat",
  "Uttar Pradesh", "Kerala", "West Bengal", "Rajasthan", "Madhya Pradesh",
];
const stateCodes = {
  Karnataka: "KA", Maharashtra: "MH", Delhi: "DL", Telangana: "TG",
  "Tamil Nadu": "TN", Gujarat: "GJ", "Uttar Pradesh": "UP", Kerala: "KL",
  "West Bengal": "WB", Rajasthan: "RJ", "Madhya Pradesh": "MP",
};
const countries = ["India", "IN"];

const crmStatuses = ["GOOD_LEAD_FOLLOW_UP", "DID_NOT_CONNECT", "BAD_LEAD", "SALE_DONE"];
const dataSources = ["leads_on_demand", "meridian_tower", "eden_park", "varah_swamy", "sarjapur_plots"];
const leadOwners = ["Alice", "Bob", "Carol", "Dave", "Eve", "Frank", "Grace", "test@gmail.com"];
const projects = [
  "Meridian Tower", "Eden Park Villa", "Varah Swamy Residency", "Sarjapur Plots Phase 2",
  "Meridian Tower - 3BHK", "Eden Park", "Sarjapur Plots", "Skyline Heights", "Blue Ocean Residency",
];
const possessionTimes = ["Immediate", "Ready to move", "Q3 2026", "Dec 2025", "2027", "2026", "Immediate possession", ""];

// ---- helpers ----
const emailDomain = () => pick(["example.com", "gmail.com", "yahoo.com", "company.com", "outlook.com", "mail.com", "email.in"]);
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "");

function makeName() {
  const prefix = pick(titlePrefixes);
  const first = pick(firstNames);
  const last = pick(lastNames);
  return [prefix, `${first} ${last}`].filter(Boolean).join(" ");
}

function makeEmail(name) {
  const parts = name.replace(/^(Mr\.|Ms\.|Mrs\.|Dr\.)\s+/, "").split(" ");
  return `${slug(parts[0])}.${slug(parts[parts.length - 1])}@${emailDomain()}`;
}

function makeMobile() {
  const prefixes = ["98", "91", "99", "88", "90", "97", "92", "93"];
  return pick(prefixes) + String(rint(10000000, 99999999));
}

function pad2(n) { return String(n).padStart(2, "0"); }

function isoDateTime(startDay, daySpan) {
  const d = new Date(Date.UTC(2026, 4, 1) + (startDay + rint(0, daySpan)) * 86400000 + rint(0, 86399) * 1000);
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}T${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}:${pad2(d.getUTCSeconds())}.000Z`;
}

function sqlDateTime(startDay, daySpan) {
  const d = new Date(Date.UTC(2026, 4, 1) + (startDay + rint(0, daySpan)) * 86400000 + rint(0, 86399) * 1000);
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())} ${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}:${pad2(d.getUTCSeconds())}`;
}

function fbDateTime() {
  const d = new Date(Date.UTC(2026, 4, 1) + rint(0, 70) * 86400000 + rint(0, 86399) * 1000);
  return d.toISOString().replace(".000Z", "+0000");
}

function istDateTime() {
  const d = new Date(Date.UTC(2026, 4, 1) + rint(0, 70) * 86400000 + rint(0, 86399) * 1000);
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())} ${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}:${pad2(d.getUTCSeconds())} IST`;
}

function messyDate() {
  const d = new Date(Date.UTC(2026, rint(0, 4), rint(1, 28)) + rint(0, 86399) * 1000);
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth() + 1;
  const day = d.getUTCDate();
  const fmt = pick(["dmy-slash", "d-M-y", "M d y", "ymd-slash"]);
  switch (fmt) {
    case "dmy-slash": return `${pad2(day)}/${pad2(m)}/${y}`;
    case "d-M-y": return `${pad2(day)}-${["Jan","Feb","Mar","Apr","May"][m-1]}-${y}`;
    case "M d y": return `${["Jan","Feb","Mar","Apr","May"][m-1]} ${day} ${y}`;
    case "ymd-slash": return `${y}/${pad2(m)}/${pad2(day)}`;
  }
}

function csvEscape(value) {
  if (value === null || value === undefined) return "";
  const s = String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function writeCsv(name, header, rows, { bom = false } = {}) {
  const content = (bom ? "\uFEFF" : "") + [header, ...rows.map((r) => r.map(csvEscape).join(","))].join("\n") + "\n";
  const file = resolve(OUT_DIR, name);
  writeFileSync(file, content, "utf8");
  return rows.length;
}

// ============================================================
// ADVERSARIAL / BAD-DATA PAYLOADS
// Each is a function returning an array matching a given fixture's columns.
// ============================================================

// Shared malformed value sets
const INJECTION = [
  '=cmd|"/c calc"!A1',          // Excel formula injection
  "+SUM(1+1)*cmd",              // formula
  "-cmd|'/c notepad'!A1",       // formula alt
  '@SUM(1+1)',                  // formula
];
const XSS = [
  '<script>alert("xss")</script>',
  '<img src=x onerror=alert(1)>',
  'javascript:alert(1)',
  '"><svg/onload=alert(1)>',
];
const BAD_DATES = [
  "not a date", "2026-13-40", "0000-00-00", "yesterday", "32/13/2026",
  "2026/02/30", "null", "", "🗓️", "2026", "Marchish 2026",
];
const BAD_EMAILS = [
  "not-an-email", "foo@@bar", "@example.com", "foo@bar", "plaintext",
  "a@b@c.com", "email with spaces@x.com", "test@.com", "",
];
const BAD_PHONES = [
  "abcd", "12", "0000000000", "+91-", "phone", "12345678901234567890",
  "(123)", "NaN", "", "+91 000 000 0000",
];
const BAD_STATUS = ["good", "FOLLOW_UP", "lead", "HOT", "123", "DONE", "maybe"];
const BAD_SOURCE = ["facebook", "google", "unknown_src", "leads", "FB", "x"];
const CONTROL = ["line1\nline2", "tab\there", "bell\u0007", "null\u0000byte"];

// 1) sample-crm bad rows (15 cols)
function badSampleCrm(i) {
  const base = () => [
    isoDateTime(0, 120), makeName(), makeEmail(makeName()), "+91", makeMobile(),
    pick(companies), pick(cities), pick(states), pick(countries), pick(leadOwners),
    pick(crmStatuses), pick(["note a", "note b"]), pick(dataSources), pick(possessionTimes), "",
  ];
  const cases = [
    () => { const r = base(); r[3] = "=cmd|'/c calc'!A1"; return r; },          // injected country_code
    () => { const r = base(); r[10] = "HOT_LEAD"; return r; },                   // invalid status
    () => { const r = base(); r[12] = "facebook"; return r; },                   // invalid source
    () => { const r = base(); r[2] = "not-an-email"; return r; },               // bad email (phone kept) -> imports w/ invalid email
    () => { const r = base(); r[1] = '<script>alert(1)</script>'; return r; },   // xss name
    () => { const r = base(); r[0] = "not a date"; return r; },                  // bad date
    () => { const r = base(); r[11] = "null\u0000byte in note"; return r; },     // control char in note (still has contact)
    () => { const r = base(); r[11] = "line1\nline2"; return r; },               // embedded newline in note
    () => { const r = base(); r[0] = ""; return r; },                            // empty date
    () => { const r = base(); r[6] = ""; r[7] = ""; r[8] = ""; return r; },      // missing location
    () => { const r = base(); r[1] = "A".repeat(2000); return r; },              // oversized name
    () => { const r = base(); r[2] = "a@b.com" + ", extra@x.com"; r[4] = makeMobile() + ", 9998887776"; return r; }, // multi contact -> note split
  ];
  return cases[i % cases.length]();
}

// 2) facebook bad rows (15 cols) - platform export style
function badFacebook(i) {
  const base = () => [
    `10${String(200 + i)}`, fbDateTime(), `ad_${rint(88000,88999)}`,
    pick(["Spring Tower Lead Form","Eden Park FB Form","Sarjapur Plots Form"]),
    pick(["Awareness - Bengaluru","Retargeting - Pune","Lookalike - KA"]),
    pick(["Meridian Q2","Eden Park Launch","Sarjapur Plots"]),
    pick(["Meridian Tower Interest Form","Eden Park Brochure Form","Sarjapur Plots Waitlist"]),
    rng() < 0.3 ? "true" : "false", pick(["fb","ig"]),
    makeName(), makeEmail(makeName()), makeMobile(), pick(cities), fbDateTime().slice(0,10), "",
  ];
  const cases = [
    () => { const r = base(); r[10] = '=cmd|"/c calc"!A1'; return r; },         // injected email
    () => { const r = base(); r[11] = '<img src=x onerror=alert(1)>'; return r; }, // xss phone/name
    () => { const r = base(); r[9] = "not-an-email"; r[11] = "abcd"; return r; }, // bad email+phone
    () => { const r = base(); r[10] = "a@b.com, c@d.com"; return r; },          // multi-email
    () => { const r = base(); r[11] = "+91 98261 90095, 9777731245, 98000 00000"; return r; }, // multi-phone
    () => { const r = base(); r[1] = "not a date"; return r; },                 // bad created_time
    () => { const r = base(); r[9] = ""; r[11] = ""; return r; },               // NO contact -> skip
    () => { const r = base(); r[8] = "BOM\uFEFFtest"; return r; },              // stray BOM in field
    () => { const r = base(); r[9] = "Robert'); DROP TABLE leads;--"; return r; }, // SQL-ish injection
    () => { const r = base(); r[3] = "x".repeat(1500); return r; },             // oversized ad_name
  ];
  return cases[i % cases.length]();
}

// 3) google-ads bad rows (14 cols)
function badGoogle(i) {
  const base = () => [
    pick(["Meridian Tower Search","Eden Park Display","Sarjapur Plots Search"]),
    pick(["Brand - Meridian","Generic - Apartments","Retargeting","Land Intent"]),
    pick(["Search Ad A","Search Ad B","Display Banner","Search Ad C"]),
    chance(0.9) ? pick(["meridian tower bengaluru","2bhk apartments whitefield","plots for sale sarjapur"]) : "",
    pick(["Meridian Lead Form","Eden Park Contact Form","Sarjapur Plots Form"]),
    pick(firstNames), pick(lastNames),
    `${slug(pick(firstNames))}.${slug(pick(lastNames))}@${emailDomain()}`,
    makeMobile(), `${pick(cities)} ${pick(states)} ${pick(countries)}`,
    pick(["Mobile","Desktop","Tablet"]), istDateTime(),
    (chance(0.3) ? 0.5 : 1).toFixed(2), `Cj0KCQjw_${rint(100,999)}`,
  ];
  const cases = [
    () => { const r = base(); r[7] = '<script>alert(1)</script>'; return r; },   // xss email
    () => { const r = base(); r[8] = '=cmd|"/c calc"!A1'; return r; },           // injected phone
    () => { const r = base(); r[7] = "not-an-email"; r[8] = "abcd"; return r; },  // bad email+phone
    () => { const r = base(); r[11] = "not a date"; return r; },                 // bad conversion time
    () => { const r = base(); r[6] = ""; r[7] = ""; r[8] = ""; return r; },       // NO contact -> skip
    () => { const r = base(); r[5] = "John\nJane"; return r; },                  // newline in first name
    () => { const r = base(); r[7] = "a@b.com, c@d.com"; return r; },            // multi-email
    () => { const r = base(); r[12] = "NaN"; return r; },                        // bad conversion value
    () => { const r = base(); r[4] = "x".repeat(1800); return r; },              // oversized lead form
    () => { const r = base(); r[9] = "Bengaluru\tKarnataka"; return r; },        // control char in location
  ];
  return cases[i % cases.length]();
}

// 4) messy-re bad rows (15 cols) - real-estate messy style
function badMessyRe(i) {
  const base = () => [
    messyDate(), `${pick(firstNames)} & ${pick(firstNames)}`,
    makeEmail(makeName()), makeMobile(), chance(0.5) ? `080-${rint(1000,9999)}-${rint(1000,9999)}` : "",
    chance(0.6) ? pick(companies) : "", pick(cities), pick(states), pick(countries),
    pick(leadOwners), pick(["follow up soon","did not connect","hot lead / good","closed won","new"]),
    pick(["Wants site visit","Tried twice - busy","Came via referral"]),
    chance(0.7) ? pick(projects) : "", chance(0.6) ? pick(possessionTimes) : "",
    chance(0.5) ? "Referral customer" : "",
  ];
  const cases = [
    () => { const r = base(); r[2] = '=cmd|"/c calc"!A1'; return r; },           // injected email
    () => { const r = base(); r[1] = '<svg/onload=alert(1)>'; return r; },       // xss name
    () => { const r = base(); r[2] = "not-an-email"; r[3] = "abcd"; r[4]=""; return r; }, // bad email+phone
    () => { const r = base(); r[0] = "32/13/2026"; return r; },                  // impossible date
    () => { const r = base(); r[2] = ""; r[3] = ""; r[4] = ""; return r; },      // NO contact -> skip
    () => { const r = base(); r[1] = "Vikram &"; r[2] = "foo@@bar"; return r; }, // malformed name+email
    () => { const r = base(); r[10] = "HOT"; return r; },                        // invalid-ish status
    () => { const r = base(); r[2] = "a@b.com; c@d.com"; r[3] = makeMobile() + " / " + makeMobile(); return r; }, // multi contact
    () => { const r = base(); r[1] = "null\u0000byte"; return r; },              // null byte in name
    () => { const r = base(); r[6] = "x".repeat(1500); return r; },              // oversized company
  ];
  return cases[i % cases.length]();
}

// 5) no-contact bad rows (7 cols) - must all be skipped (no email/phone)
function badNoContact(i) {
  const base = () => [
    chance(0.5) ? pick(["Anonymous Visitor","Walk-in Lead","Event Booth Contact","Referral Name Only"]) : makeName(),
    pick(cities), pick(states), pick(countries),
    chance(0.4) ? pick(companies) : "",
    pick(["Walk-in at site office - left without details","Interested in brochure only","Met at PropTech Expo - card incomplete","Friend of existing buyer - no phone given yet"]),
    chance(0.6) ? pick(projects) : "",
  ];
  const cases = [
    () => { const r = base(); r[0] = '<script>alert(1)</script>'; return r; },   // xss name, still no contact
    () => { const r = base(); r[4] = '=cmd|"/c calc"!A1'; return r; },           // injected company, no contact
    () => { const r = base(); r[0] = "A".repeat(1500); return r; },              // oversized, no contact
    () => { const r = base(); r[6] = "x".repeat(1200); return r; },              // oversized project, no contact
    () => { const r = base(); r[5] = "line1\nline2"; return r; },                // newline in notes, no contact
  ];
  return cases[i % cases.length]();
}

// ============================================================
// GENERATORS
// ============================================================

function genSampleCrm() {
  const header = [
    "created_at", "name", "email", "country_code", "mobile_without_country_code",
    "company", "city", "state", "country", "lead_owner", "crm_status", "crm_note",
    "data_source", "possession_time", "description",
  ];
  const rows = [];
  for (let i = 0; i < 110; i++) {
    const name = makeName();
    const state = pick(states);
    const mobile = makeMobile();
    rows.push([
      isoDateTime(0, 120), name,
      chance(0.95) ? makeEmail(name) : "",
      "+91", mobile,
      chance(0.85) ? pick(companies) : "",
      pick(cities), state, pick(countries), pick(leadOwners),
      pick(crmStatuses),
      chance(0.7) ? pick(["Call back next week","No answer on two attempts","Wrong number provided","Booking confirmed","Client is asking to reschedule demo","Deal closed, onboarding in progress","Will try again next week","Hot lead from website"]) : "",
      chance(0.9) ? pick(dataSources) : "",
      chance(0.7) ? pick(possessionTimes) : "",
      chance(0.6) ? pick(["Interested in 2BHK","Hot lead from website","Spam enquiry","Closed 3BHK unit","Referred by friend","Requested brochure","Wants virtual tour",""]) : "",
    ]);
  }
  for (let i = 0; i < 12; i++) rows.push(badSampleCrm(i));
  return writeCsv("sample-crm.csv", header.join(","), rows);
}

function genFacebookLeads() {
  const header = [
    "id", "created_time", "ad_id", "ad_name", "adset_name", "campaign_name",
    "form_name", "is_organic", "platform", "Full Name", "Email Address",
    "Phone Number", "City", "Submitted", "job_title",
  ];
  const adNames = ["Spring Tower Lead Form", "Eden Park FB Form", "Sarjapur Plots Form", "Meridian Tower Interest Form"];
  const adsets = ["Awareness - Bengaluru", "Retargeting - Pune", "Lookalike - KA", "Awareness - Mumbai"];
  const campaigns = ["Meridian Q2", "Eden Park Launch", "Sarjapur Plots"];
  const forms = ["Meridian Tower Interest Form", "Eden Park Brochure Form", "Sarjapur Plots Waitlist"];
  const jobs = ["Software Engineer", "Product Manager", "Business Owner", "Architect", "Doctor", "Teacher", "Consultant", "Student", "Entrepreneur", "CA", ""];
  const rows = [];
  for (let i = 0; i < 100; i++) {
    const name = makeName();
    const mobile = makeMobile();
    const phone = pick([
      () => mobile,
      () => `+91 ${mobile.slice(0,5)} ${mobile.slice(5)}`,
      () => `919876${rint(100000,999999)}`,
      () => `080-4111${rint(1000,9999)} / ${makeMobile()}`,
      () => `+91 ${makeMobile()}, ${makeMobile()}`,
    ])();
    rows.push([
      `10${String(100 + i)}`, fbDateTime(), `ad_${rint(88000,88999)}`,
      pick(adNames), pick(adsets), pick(campaigns), pick(forms),
      rng() < 0.3 ? "true" : "false", pick(["fb","ig"]), name,
      chance(0.9) ? makeEmail(name) : "", phone, pick(cities),
      fbDateTime().slice(0,10), chance(0.8) ? pick(jobs) : "",
    ]);
  }
  // Deterministic pinned row (facebook mapping test relies on it).
  // Inserted first so rows.find("Neha") resolves to this exact row.
  rows.unshift([
    `10${String(200)}`, "2026-05-11T10:45:01+0000", "ad_88422",
    "Spring Tower Lead Form", "Awareness - Bengaluru", "Meridian Q2",
    "Meridian Tower Interest Form", "false", "ig", "Neha Kapoor",
    "neha.kapoor@yahoo.com", "+91 98111 22334, 9811122335", "Mumbai",
    "2026-05-11", "Product Manager",
  ]);
  for (let i = 0; i < 10; i++) rows.push(badFacebook(i));
  return writeCsv("facebook-leads.csv", header.join(","), rows);
}

function genGoogleAds() {
  const header = [
    "Campaign", "Ad group", "Ad", "Keyword", "Lead form", "First name",
    "Last name", "Email", "Phone", "User location", "Device", "Conversion time",
    "Conversion value", "GCLID",
  ];
  const campaigns = ["Meridian Tower Search", "Eden Park Display", "Sarjapur Plots Search"];
  const adGroups = ["Brand - Meridian", "Generic - Apartments", "Retargeting", "Land Intent"];
  const ads = ["Search Ad A", "Search Ad B", "Display Banner", "Search Ad C"];
  const forms = ["Meridian Lead Form", "Eden Park Contact Form", "Sarjapur Plots Form"];
  const keywords = ["meridian tower bengaluru", "2bhk apartments whitefield", "plots for sale sarjapur", "eden park villa"];
  const devices = ["Mobile", "Desktop", "Tablet"];
  const rows = [];
  for (let i = 0; i < 50; i++) {
    const first = pick(firstNames);
    const last = pick(lastNames);
    const city = pick(cities);
    const state = pick(states);
    const mobile = makeMobile();
    const phone = pick([
      () => `+91${mobile}`, () => mobile, () => `+91-${mobile.slice(0,5)}-${mobile.slice(5)}`,
      () => `0${rint(10,99)}-${rint(10000000,99999999)}`,
    ])();
    rows.push([
      pick(campaigns), pick(adGroups), pick(ads),
      chance(0.9) ? pick(keywords) : "", pick(forms), first, last,
      chance(0.92) ? `${slug(first)}.${slug(last)}@${emailDomain()}` : "", phone,
      `${pick([city, city + " " + state, city + " " + state + " " + pick(countries)])}`,
      pick(devices), istDateTime(), (chance(0.3) ? 0.5 : 1).toFixed(2),
      `Cj0KCQjw_${slug(pick(["abc","def","ghi","jkl","mno","pqr"]) + rint(100,999))}`,
    ]);
  }
  for (let i = 0; i < 10; i++) rows.push(badGoogle(i));
  return writeCsv("google-ads.csv", header.join(","), rows);
}

function genMessyRe() {
  const header = [
    "Lead Date", "Client Name", "Contact Email", "Mobile No.", "Alt Phone",
    "Company / Org", "Location City", "State/UT", "Country", "Assigned To",
    "Status (internal)", "Remarks / Notes", "Project Interest", "Possession",
    "Extra Info / Comments",
  ];
  const statuses = ["follow up soon", "did not connect", "hot lead / good", "closed won", "new", "cold", "site visit done"];
  const notes = [
    "Wants site visit this weekend", "Tried twice - busy", "Wife is primary decision maker - call after 7pm",
    "Sale done - booking amount received", "Prefers weekend calls only", "Came via referral from existing customer",
    "Budget 1.2 Cr", "Needs loan assistance", "Comparing with competitor project", "Plot #42 earmarked",
  ];
  const rows = [];
  for (let i = 0; i < 50; i++) {
    const name = chance(0.2) ? `Ms. ${pick(firstNames)} ${pick(lastNames)}` : `${pick(firstNames)} & ${pick(firstNames)}`;
    const mobile = makeMobile();
    const hasEmail = chance(0.75);
    let email;
    if (hasEmail) {
      const e1 = makeEmail(name);
      email = chance(0.15) ? `${e1}; ${makeEmail(name)}` : e1;
    } else {
      email = chance(0.4) ? "" : " ";
    }
    const phones = [mobile];
    if (chance(0.4)) phones.push(`080-${rint(1000,9999)}-${rint(1000,9999)}`);
    if (chance(0.3)) phones.push(makeMobile());
    const state = pick(states);
    rows.push([
      messyDate(), name, email.trim(),
      chance(0.85) ? phones.join(" / ") : "",
      chance(0.5) ? `080-${rint(1000,9999)}-${rint(1000,9999)}` : "",
      chance(0.6) ? pick(companies) : "",
      pick(cities), chance(0.8) ? (rng() < 0.5 ? stateCodes[state] : state) : "",
      chance(0.85) ? pick(countries) : "", pick(leadOwners),
      pick(statuses), pick(notes), chance(0.7) ? pick(projects) : "",
      chance(0.6) ? pick(possessionTimes) : "",
      chance(0.5) ? pick(["Budget 1.2 Cr", "Referral customer", "Walk-in", "Expat returning to India", "Investor - buying 2 units", ""]) : "",
    ]);
  }
  for (let i = 0; i < 10; i++) rows.push(badMessyRe(i));
  return writeCsv("messy-re.csv", header.join(","), rows);
}

function genNoContact() {
  const header = ["name", "city", "state", "country", "company", "notes", "project"];
  const names = [
    "Anonymous Visitor", "Walk-in Lead", "Event Booth Contact", "Referral Name Only",
    "Website Guest", "Expo Enquiry", "Brochure Requester", "Cold Call Prospect",
    "Newspaper Ad Respondent", "Hoarding Inquiry", "Refer-a-Friend", "Portal Lead (no details)",
  ];
  const notes = [
    "Walk-in at site office - left without details", "Interested in brochure only",
    "Met at PropTech Expo - card incomplete", "Friend of existing buyer - no phone given yet",
    "Dropped business card with no number", "Saw hoarding, visited site, left quickly",
    "Filled form partially - skipped contact fields", "Called once, did not share details",
  ];
  const rows = [];
  for (let i = 0; i < 25; i++) {
    rows.push([
      chance(0.5) ? pick(names) : makeName(), pick(cities), pick(states),
      pick(countries), chance(0.4) ? pick(companies) : "",
      pick(notes), chance(0.6) ? pick(projects) : "",
    ]);
  }
  for (let i = 0; i < 5; i++) rows.push(badNoContact(i));
  return writeCsv("no-contact.csv", header.join(","), rows, { bom: true });
}

mkdirSync(OUT_DIR, { recursive: true });
const counts = {
  "sample-crm.csv": genSampleCrm(),
  "facebook-leads.csv": genFacebookLeads(),
  "google-ads.csv": genGoogleAds(),
  "messy-re.csv": genMessyRe(),
  "no-contact.csv": genNoContact(),
};
console.log("Generated fixtures (clean + adversarial bad rows):");
for (const [f, n] of Object.entries(counts)) {
  console.log(`  ${f}: ${n} data rows`);
}
