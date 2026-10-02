import type { Rule, RuleScope } from "@/lib/types";

// Curated knowledge base for B-1 / B-2 visitors and Visa Waiver Program (VWP / ESTA) travelers.
// Every rule cites a primary or official source. Where the law is unsettled the rule text says
// "gray area" instead of guessing. Informational only, not legal advice.

const FAM_402_2 = "https://fam.state.gov/fam/09FAM/09FAM040202.html";
const FAM_302_9 = "https://fam.state.gov/fam/09FAM/09FAM030209.html";
const FAM_302_11 = "https://fam.state.gov/fam/09FAM/09FAM030211.html";
const CFR_214_1 = "https://www.ecfr.gov/current/title-8/chapter-I/subchapter-B/part-214/section-214.1";
const CFR_214_2 = "https://www.ecfr.gov/current/title-8/chapter-I/subchapter-B/part-214/section-214.2";
const CFR_217_3 = "https://www.ecfr.gov/current/title-8/chapter-I/subchapter-B/part-217/section-217.3";
const USC_1182 = "https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title8-section1182&num=0&edition=prelim";
const USC_1184 = "https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title8-section1184&num=0&edition=prelim";
const USC_1187 = "https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title8-section1187&num=0&edition=prelim";
const USC_1202 = "https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title8-section1202&num=0&edition=prelim";
const USC_1258 = "https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title8-section1258&num=0&edition=prelim";
const CBP_VWP = "https://www.cbp.gov/travel/international-visitors/visa-waiver-program";
const CBP_ESTA = "https://www.cbp.gov/travel/international-visitors/esta";
const CBP_I94 = "https://www.cbp.gov/travel/international-visitors/i-94";
const USCIS_EXTEND = "https://www.uscis.gov/visit-the-united-states/extend-your-stay";
const USCIS_CHANGE = "https://www.uscis.gov/visit-the-united-states/change-my-nonimmigrant-status";
const USCIS_UNLAWFUL = "https://www.uscis.gov/laws-and-policy/other-resources/unlawful-presence-and-inadmissibility";
const CBP_B1_SHEET = "https://www.cbp.gov/sites/default/files/2026-02/B-1%20Permissible%20Activities_2026.pdf";

const ALL: RuleScope[] = ["B1", "B2", "VWP"];
const B_VISAS: RuleScope[] = ["B1", "B2"];
const VWP_ONLY: RuleScope[] = ["VWP"];

export const VISITOR_RULES: Rule[] = [
  // ---------------------------------------------------------------- Work & money
  {
    id: "no-unauthorized-employment",
    title: "No employment in the U.S.",
    appliesTo: ALL,
    severity: "critical",
    rule:
      "Visitors (B-1, B-2, and VWP/ESTA) may not engage in any employment in the United States. \"Employment\" means service or labor performed for an employer inside the U.S., whether the payer is a company, a person, or a platform; unpaid work that would normally be paid (such as an unpaid internship) can also count.",
    examples: [
      "Accepting a job, internship, or paid trial day at a U.S. company",
      "Working shifts at a café, startup, or event in exchange for pay or free housing",
      "Doing productive work (writing code, designing, consulting) for a U.S. business while visiting",
    ],
    alternatives: [
      "Decline or defer the work until you hold a work-authorized status (e.g. H-1B, O-1, L-1, E, TN where eligible)",
      "Ask the company to sponsor a work visa and start only after approval",
      "Limit yourself to permitted business visitor activities (meetings, negotiations, conferences)",
    ],
    citation: { name: "8 CFR 214.1(e); INA 101(a)(15)(B) — visitors may not engage in employment", url: CFR_214_1 },
  },
  {
    id: "no-paid-gigs-from-us-sources",
    title: "No paid gigs, freelance work, or fees from U.S. sources",
    appliesTo: ALL,
    severity: "critical",
    rule:
      "A visitor may not receive a salary or fee from a U.S. source for services performed in the U.S. Short paid gigs count: user-research sessions, freelance contracts, consulting calls, or tasks paid by invoice, W-9, 1099, or platform payout are treated as unauthorized work (gift cards or in-kind pay are likely treated the same; that is an inference, not explicit in the sources). The only U.S.-source money allowed is narrow: reimbursement of actual incidental expenses, INA 212(q) academic honoraria, prize money in certain competition cases, and an outside director's time-and-travel pay for U.S. board meetings. None of these covers a for-profit company's paid task.",
    examples: [
      "\"$150 for a 45-minute paid feedback session — send your W-9 or invoice\"",
      "Accepting an Upwork/Fiverr contract from a U.S. client while physically in the U.S.",
      "Being paid to judge, mentor, photograph, or speak at a U.S. company event",
    ],
    alternatives: [
      "Do the session unpaid, or ask the company to defer it until you are back home",
      "Ask whether the payment can be limited to documented travel/lodging reimbursement",
      "Take freelance work only once you have left the U.S. (and check your home-country rules)",
    ],
    citation: { name: "9 FAM 402.2-5(F)(1) — no salary from a U.S. source; only incidental expenses", url: FAM_402_2 },
  },
  {
    id: "permitted-business-activities",
    title: "Permitted business-visitor activities",
    appliesTo: ["B1", "VWP"],
    severity: "low",
    rule:
      "Business visitors may consult with business associates, negotiate contracts, attend scientific, educational, professional, or business conventions, conferences, or seminars, do independent research, litigate, and take orders for goods made abroad. These are allowed as long as you do no productive work for a U.S. entity and are paid from abroad.",
    examples: [
      "Attending a tech conference or hackathon kickoff as a participant",
      "Meeting a potential partner to negotiate a contract signed on behalf of your foreign company",
      "Visiting a U.S. client to discuss requirements for work you will do from home",
    ],
    alternatives: [
      "Keep activities to meetings, events, and negotiations; do the hands-on work after you leave",
      "Carry a letter from your foreign employer describing the business purpose of the trip",
    ],
    citation: { name: "9 FAM 402.2-5(B) — commercial transactions, negotiations, consultations, conferences", url: FAM_402_2 },
  },
  {
    id: "honoraria-212q",
    title: "Academic honoraria (narrow exception)",
    appliesTo: ALL,
    severity: "medium",
    rule:
      "A B visitor may accept an honorarium plus incidental expenses only for usual academic activities (lecturing, guest teaching, academic festivals) lasting no more than 9 days at one institution, paid by a university, affiliated nonprofit, or nonprofit/government research organization, and from no more than 5 such institutions in the past 6 months. Payments from for-profit companies do not qualify. Gray area: the statute covers anyone admitted as a B visitor, but the State Department describes it as a B-1 benefit, so reliance by B-2 or VWP visitors is uncertain.",
    examples: [
      "A university paying you $500 to give a 1-day guest lecture (likely OK)",
      "A for-profit startup paying you a \"speaker honorarium\" for a meetup talk (not covered)",
      "Your sixth paid university talk in six months (exceeds the limit)",
    ],
    alternatives: [
      "Confirm the payer is a higher-education institution or nonprofit research organization",
      "Ask a for-profit host to cover only documented travel and lodging",
      "Track how many institutions have paid you in the last 6 months",
    ],
    citation: { name: "INA 212(q) (8 U.S.C. 1182(q)); 9 FAM 402.2-5(F)(2)", url: USC_1182 },
  },
  {
    id: "incidental-expense-reimbursement",
    title: "Reimbursement of reasonable incidental expenses is OK",
    appliesTo: ALL,
    severity: "low",
    rule:
      "A U.S. source may reimburse or provide an allowance for expenses incidental to your visit: travel to and from the event plus reasonable meals, lodging, laundry, and basic services. The amount must not exceed actual reasonable expenses; anything beyond that looks like compensation.",
    examples: [
      "A conference covering your flight and hotel (OK)",
      "A flat $2,000 \"stipend\" far above your actual costs (looks like pay)",
    ],
    alternatives: [
      "Ask for reimbursement against receipts rather than a flat fee",
      "Keep receipts and the invitation letter describing what is covered",
    ],
    citation: { name: "9 FAM 402.2-5(F)(1) — incidental expenses or remuneration", url: FAM_402_2 },
  },
  {
    id: "remote-work-foreign-employer-gray",
    title: "Remote work for your home-country employer — gray area",
    appliesTo: ALL,
    severity: "medium",
    rule:
      "Gray area: no statute, regulation, or State Department/CBP guidance expressly permits or forbids a visitor from doing remote work for a foreign employer, paid abroad, while in the U.S. Brief tasks incidental to a job based abroad (answering urgent emails, a few calls) are lower risk; sustained or full-time work from U.S. soil can look like labor \"within the United States\" and like living here (CBP: not permissible to \"in effect, live and work in the United States\"). Officers decide case by case; answer CBP truthfully.",
    examples: [
      "Your employer at home asks you to work remotely from the U.S. for a few days",
      "Planning a multi-week \"workation\" in the U.S. working full time for a foreign company",
      "Telling a CBP officer your purpose is tourism while planning to work remotely every day",
    ],
    alternatives: [
      "Take leave or keep work to brief, incidental check-ins",
      "Do substantial work blocks after you leave the U.S.",
      "If remote work is a main purpose of the trip, ask an immigration attorney before you travel",
    ],
    citation: { name: "INA 101(a)(15)(B); 9 FAM 402.2-5(A) — no source directly addresses remote work", url: FAM_402_2 },
  },
  {
    id: "volunteering-limits",
    title: "Volunteering has strict limits",
    appliesTo: ALL,
    severity: "medium",
    rule:
      "Volunteering is permitted only in narrow cases, such as an organized voluntary service program of a recognized religious or nonprofit charitable organization you are a member of and committed to, that does not involve selling articles or soliciting donations, with no salary from a U.S. source beyond incidental expenses. \"Volunteering\" for a for-profit company, or unpaid work that would normally be a paid job, is treated as unauthorized employment.",
    examples: [
      "\"Volunteering\" at a startup in exchange for room and board",
      "Unpaid internship at a U.S. company",
      "Helping at a charity event run by a nonprofit you are a member of (may be OK)",
    ],
    alternatives: [
      "Attend as a guest or participant rather than staff",
      "Confirm the organization is a recognized nonprofit and the work is not a normally paid role",
    ],
    citation: { name: "9 FAM 402.2-5(C)(2) — participants in voluntary service programs", url: FAM_402_2 },
  },
  {
    id: "study-limits",
    title: "No enrolling in a course of study",
    appliesTo: ALL,
    severity: "high",
    rule:
      "A B-1/B-2 visitor violates status by enrolling in a course of study; you need F-1 or M-1 status first. Recreational or avocational study not for credit toward a degree is allowed, whether incidental to a tourist trip or the main purpose of a B-2 visit. VWP travelers follow the same principle.",
    examples: [
      "Enrolling in a for-credit university semester or a full-time coding bootcamp",
      "Signing up for a degree program and starting classes while on ESTA",
      "Taking a weekend cooking class while on vacation (OK)",
    ],
    alternatives: [
      "Apply for an F-1/M-1 visa from abroad before starting classes",
      "B visa holders may ask USCIS for a change of status, and must not start classes until approved",
      "Choose a short recreational, non-credit course",
    ],
    citation: { name: "8 CFR 214.2(b)(7); 9 FAM 402.2-4(A)(6) — study limits", url: CFR_214_2 },
  },
  {
    id: "contests-and-prizes-gray",
    title: "Hackathons, contests, and prize money — gray area",
    appliesTo: ALL,
    severity: "medium",
    rule:
      "Gray area: competing is generally fine (amateurs may compete on B-2 if not paid for participating). No official source addresses hackathon prizes: professional entertainers may receive a prize \"(monetary or otherwise)\" and professional athletes based abroad may receive prize money, but amateurs compete \"if not being paid.\" A one-time, merit-judged prize with no IP transfer or sponsor deliverables is lower risk; bounties, sponsor-commissioned builds, IP assignment, or follow-on paid work are higher risk. Tax: a U.S. prize is U.S.-source income (expect a W-8BEN and possible 30% withholding).",
    examples: [
      "Receiving a $5,000 hackathon prize via a W-9 or 1099 payment",
      "A prize conditioned on building a feature for the sponsor after the event",
      "Competing in a hackathon with no prize money (OK)",
    ],
    alternatives: [
      "Ask whether the prize can be paid after you leave, to a foreign account, as a prize (not a service fee)",
      "Decline follow-up paid work or contracts tied to the prize",
      "If the amount is significant, ask an immigration attorney before accepting",
    ],
    citation: { name: "9 FAM 402.2-4(A)(7), 402.2-5(C)(4)(a), 402.2-5(G)(2) — contests and prizes", url: FAM_402_2 },
  },
  {
    id: "job-interviews-networking",
    title: "Job interviews and networking are generally OK",
    appliesTo: ALL,
    severity: "low",
    rule:
      "No regulation or FAM section mentions job interviews specifically, but they are widely treated as permitted business-visitor activity (consultations, conferences) because no work is done. You may not start working, do paid or unpaid trial work, or accept a role that begins before you hold work authorization. Interviewing does not change your obligation to leave on time.",
    examples: [
      "Interviewing on-site with a U.S. company (generally OK)",
      "A \"take-home\" paid trial project or onboarding day while visiting (not OK)",
      "Signing an offer that starts next Monday while still a visitor (not OK)",
    ],
    alternatives: [
      "Interview, then have the employer file a work-visa petition; start only after approval",
      "Decline trial work until you are authorized",
    ],
    citation: { name: "9 FAM 402.2-5(B) — consult with business associates, negotiate contracts", url: FAM_402_2 },
  },
  {
    id: "founder-business-activities",
    title: "Founders: meetings and fundraising OK, hands-on work not",
    appliesTo: ["B1", "VWP"],
    severity: "medium",
    rule:
      "A founder or board member may attend board meetings, pitch investors, and negotiate deals as a business visitor; a U.S. corporation may pay an outside director for time and travel to attend board meetings. Seeking investment is permitted, but visitors are barred from performing productive labor for the U.S. company, such as building the product, managing staff day to day, or taking a U.S. salary.",
    examples: [
      "Pitching U.S. investors for your startup (OK)",
      "Running daily operations of your U.S. Delaware C-corp from San Francisco (not OK)",
    ],
    alternatives: [
      "Keep U.S. trips to meetings, fundraising, and negotiations",
      "Explore E-2, L-1, or O-1 status for operating the company in the U.S.",
    ],
    citation: { name: "9 FAM 402.2-5(C)(3), (C)(7); CBP B-1 Permissible Activities Q20", url: CBP_B1_SHEET },
  },
  {
    id: "ssn-and-tax-forms",
    title: "W-9s, invoices, and U.S. payroll are red flags",
    appliesTo: ALL,
    severity: "high",
    rule:
      "Being asked for a W-9, to invoice a U.S. company for services, to join U.S. payroll, or to obtain a Social Security number for pay is a strong signal the payment is compensation for services. Visitors are generally not eligible for an SSN for work purposes, and a W-9 is a U.S.-person tax form. A W-8BEN request alone (for example for a prize) is a tax step, not proof of work, but pay for services is still barred.",
    examples: [
      "\"Please send your W-9 so we can pay you\"",
      "Being onboarded to a U.S. payroll system during your visit",
    ],
    alternatives: [
      "Pause and ask what the payment is for; if it is for your services, decline while visiting",
      "Ask for receipt-based expense reimbursement instead",
    ],
    citation: { name: "9 FAM 402.2-5(I) — nonimmigrants obtaining Social Security cards", url: FAM_402_2 },
  },

  // ---------------------------------------------------------------- VWP stay rules
  {
    id: "vwp-permitted-purposes",
    title: "VWP covers tourism and business visits only",
    appliesTo: VWP_ONLY,
    severity: "low",
    rule:
      "The Visa Waiver Program lets eligible nationals visit for tourism or business (the same kinds of activities as a B visitor) for up to 90 days with an approved ESTA. It does not allow work, study for credit, or long-term residence.",
    examples: ["Sightseeing, visiting friends, attending a conference (OK)", "Moving to the U.S. to job-hunt for months (not OK)"],
    alternatives: ["If your plans exceed tourism/business visiting, apply for the appropriate visa before travel"],
    citation: { name: "CBP — Visa Waiver Program", url: CBP_VWP },
  },
  {
    id: "vwp-90-day-limit",
    title: "VWP: 90 days maximum",
    appliesTo: VWP_ONLY,
    severity: "critical",
    rule:
      "VWP travelers are admitted for up to 90 days. You must leave the U.S. on or before day 90; there is no grace period.",
    examples: ["Booking a return flight on day 92", "Planning to \"stay a bit longer\" after the 90 days"],
    alternatives: [
      "Book departure on or before your last allowed day and check it on your I-94 record",
      "If you need more than 90 days, leave and apply for a B visa from abroad",
    ],
    citation: { name: "INA 217(a)(1) (8 U.S.C. 1187); CBP Visa Waiver Program", url: USC_1187 },
  },
  {
    id: "vwp-no-extension-or-change",
    title: "VWP: no extension and no change of status",
    appliesTo: VWP_ONLY,
    severity: "high",
    rule:
      "VWP travelers cannot extend their stay or change to another nonimmigrant status (for example to F-1 or H-1B) from inside the U.S. The only relief is \"satisfactory departure\": if an emergency prevents departure, USCIS may grant up to 30 extra days.",
    examples: [
      "Filing Form I-539 to extend an ESTA stay (not available)",
      "Trying to switch from ESTA to a student or work visa without leaving",
    ],
    alternatives: [
      "Leave the U.S. and apply for the right visa at a U.S. consulate",
      "If a genuine emergency (illness, flight cancellation) prevents departure, contact USCIS about satisfactory departure before day 90",
    ],
    citation: { name: "INA 248(a)(4) (8 U.S.C. 1258); 8 CFR 217.3(a) satisfactory departure", url: USC_1258 },
  },
  {
    id: "vwp-contiguous-territory-clock",
    title: "VWP: trips to Canada/Mexico do not reset the 90 days",
    appliesTo: VWP_ONLY,
    severity: "high",
    rule:
      "If you leave for Canada, Mexico, or an adjacent Caribbean island and come back, you are readmitted only for the balance of your original 90-day period. The clock keeps running; a \"weekend in Vancouver\" does not reset it.",
    examples: [
      "Day 80: weekend trip to Vancouver, expecting a fresh 90 days on return (wrong)",
      "Cruise to the Bahamas and back, then staying past the original day 90",
    ],
    alternatives: [
      "Count days from your original VWP admission, including side trips",
      "Plan your final departure to a non-adjacent country before day 90",
    ],
    citation: { name: "8 CFR 217.3(b) — readmission after departure to contiguous territory", url: CFR_217_3 },
  },
  {
    id: "vwp-overstay-loses-eligibility",
    title: "VWP: an overstay ends future VWP eligibility",
    appliesTo: VWP_ONLY,
    severity: "critical",
    rule:
      "Anyone who has ever overstayed a VWP admission or violated its terms is no longer eligible for the VWP and must apply for a visa for future trips.",
    examples: ["Leaving one day late after a 90-day ESTA stay", "Working during a VWP visit"],
    alternatives: ["Leave on time; if an emergency arises, seek satisfactory departure before day 90"],
    citation: { name: "INA 217(a)(7) (8 U.S.C. 1187)", url: USC_1187 },
  },
  {
    id: "vwp-waiver-of-review",
    title: "VWP: you waived the right to contest removal",
    appliesTo: VWP_ONLY,
    severity: "medium",
    rule:
      "As a condition of VWP admission you waived the right to review or appeal an officer's admissibility decision and to contest removal (except asylum). If CBP or ICE decides you violated the terms, you can be removed quickly without a hearing.",
    examples: ["Being refused entry after telling CBP you plan to freelance", "Removal after unauthorized work is discovered"],
    alternatives: ["Answer CBP truthfully and keep activities within VWP purposes"],
    citation: { name: "INA 217(b) (8 U.S.C. 1187(b)) — waiver of rights", url: USC_1187 },
  },
  {
    id: "vwp-esta-validity",
    title: "ESTA validity and new passports",
    appliesTo: VWP_ONLY,
    severity: "medium",
    rule:
      "An approved ESTA is generally valid for two years or until your passport expires, whichever comes first. A new passport needs a new ESTA. ESTA approval does not guarantee admission; the CBP officer decides at the border.",
    examples: ["Traveling on a renewed passport with the old ESTA", "Assuming ESTA lets you stay as long as it is valid"],
    alternatives: ["Check ESTA status before each trip and reapply after a passport renewal"],
    citation: { name: "CBP — ESTA", url: CBP_ESTA },
  },

  // ---------------------------------------------------------------- B visa stay rules
  {
    id: "b2-i94-admit-until",
    title: "B visas: your I-94 date, not your visa, sets your stay",
    appliesTo: B_VISAS,
    severity: "critical",
    rule:
      "Your permitted stay ends on the \"admit until\" date on your I-94 record, not on your visa's expiration date. A 10-year visa does not let you stay 10 years. B visitors are commonly admitted for 6 months or less; the regulation allows up to 1 year (8 CFR 214.2(b)(1)). Check your I-94 online after each entry.",
    examples: [
      "Assuming you can stay until the visa expires in 2034",
      "Not checking the I-94 and missing an admit-until date shorter than expected",
    ],
    alternatives: ["Look up your I-94 at i94.cbp.dhs.gov after every entry", "Plan departure on or before the admit-until date"],
    citation: { name: "CBP — I-94 Arrival/Departure Record", url: CBP_I94 },
  },
  {
    id: "b2-extension-i539",
    title: "B visas: extend with Form I-539 before your I-94 expires",
    appliesTo: B_VISAS,
    severity: "high",
    rule:
      "B-1/B-2 visitors who need more time may file Form I-539 with USCIS before the I-94 admit-until date. Extensions are granted in increments of up to 6 months and are discretionary. File early; a late filing generally is not accepted.",
    examples: ["Waiting until after the I-94 date to ask for more time", "Assuming an extension is automatic"],
    alternatives: [
      "File I-539 well before the admit-until date with evidence of why you need more time and funds to support yourself",
      "Otherwise depart on time",
    ],
    citation: { name: "USCIS — Extend Your Stay; 8 CFR 214.2(b)(1)", url: USCIS_EXTEND },
  },
  {
    id: "b-change-of-status",
    title: "B visas: changing status from inside the U.S.",
    appliesTo: B_VISAS,
    severity: "medium",
    rule:
      "B visitors may be able to apply to USCIS to change to another status (for example F-1) if they are still in status and have not violated its terms. You must not start the new activity (classes, work) until USCIS approves.",
    examples: ["Starting classes while a B-to-F-1 change of status is pending", "Accepting a job before an H-1B change of status is approved"],
    alternatives: ["Wait for approval before starting the new activity, or apply for the new visa from abroad"],
    citation: { name: "USCIS — Change My Nonimmigrant Status", url: USCIS_CHANGE },
  },
  {
    id: "visa-voidance-222g",
    title: "Overstaying voids your visa",
    appliesTo: B_VISAS,
    severity: "high",
    rule:
      "If you stay even one day beyond your authorized period, your visa is automatically void. You generally must then apply for any new visa in your country of nationality, which is slower and harder.",
    examples: ["Leaving a day after your I-94 admit-until date", "Staying past the I-94 date while waiting on a late extension request"],
    alternatives: ["Depart on time or file a timely extension (I-539) before your I-94 date"],
    citation: { name: "INA 222(g) (8 U.S.C. 1202(g))", url: USC_1202 },
  },

  // ---------------------------------------------------------------- Applies to everyone
  {
    id: "unlawful-presence-bars",
    title: "Overstays trigger 3-year and 10-year bars",
    appliesTo: ALL,
    severity: "critical",
    rule:
      "Time in the U.S. after your authorized stay ends counts as unlawful presence. More than 180 days but less than one year, followed by voluntary departure before removal proceedings begin, triggers a 3-year bar on returning; one year or more (then departing or being removed) triggers a 10-year bar.",
    examples: ["Staying 7 months past your I-94 date, then leaving", "Overstaying a 90-day VWP admission by months"],
    alternatives: ["Track your last allowed day and depart before it", "Speak to an immigration attorney immediately if you have already overstayed"],
    citation: { name: "INA 212(a)(9)(B) (8 U.S.C. 1182(a)(9)(B)); USCIS unlawful presence", url: USCIS_UNLAWFUL },
  },
  {
    id: "misrepresentation",
    title: "Never misstate your purpose to CBP or consular officers",
    appliesTo: ALL,
    severity: "critical",
    rule:
      "Willfully misrepresenting a material fact (such as your purpose of travel, planned work, or prior overstays) to obtain a visa, ESTA, or admission makes you permanently inadmissible unless you obtain a waiver.",
    examples: [
      "Telling CBP you are a tourist when you have a U.S. job lined up",
      "Answering \"no\" to the ESTA question about prior overstays when you have one",
    ],
    alternatives: ["Answer every question truthfully", "If your plans do not fit visitor status, apply for the correct visa"],
    citation: { name: "INA 212(a)(6)(C)(i) (8 U.S.C. 1182); 9 FAM 302.9", url: FAM_302_9 },
  },
  {
    id: "ninety-day-rule-inconsistent-conduct",
    title: "Conduct inconsistent with your visit within 90 days of entry",
    appliesTo: ALL,
    severity: "high",
    rule:
      "If within 90 days of entry you do something inconsistent with visitor status (start working, enroll in school, or marry and seek to stay permanently), consular officers may presume you misrepresented your intent when you entered. After 90 days there is no presumption, but the conduct can still be examined.",
    examples: [
      "Starting a job 3 weeks after entering as a tourist",
      "Enrolling in a full-time program a month after arriving on ESTA",
    ],
    alternatives: ["Only do what you declared at entry", "Consult an immigration attorney before any change of plans"],
    citation: { name: "9 FAM 302.9-4(B)(3)(g) — 90-day rule (inconsistent conduct)", url: FAM_302_9 },
  },
  {
    id: "immigrant-intent",
    title: "Visitors must not intend to stay permanently",
    appliesTo: ALL,
    severity: "high",
    rule:
      "Visitors are presumed to be intending immigrants until they show otherwise; you must keep a residence abroad you do not intend to abandon and plan to leave at the end of your visit. Actions such as signing a long-term lease, moving belongings, or saying you are relocating undercut this.",
    examples: [
      "Signing a 12-month apartment lease while on ESTA",
      "Telling a CBP officer you are \"moving to San Francisco\"",
      "Repeated back-to-back visits that add up to living in the U.S.",
    ],
    alternatives: [
      "Keep proof of ties at home (job, lease, return ticket)",
      "If you want to live in the U.S., pursue the right immigrant or work visa",
    ],
    citation: { name: "INA 214(b) (8 U.S.C. 1184(b)) — presumption of immigrant intent", url: USC_1184 },
  },
  {
    id: "unlawful-activity",
    title: "No unlawful activity while visiting",
    appliesTo: ALL,
    severity: "high",
    rule:
      "Visitor status assumes lawful activity. Unlawful or criminal conduct, including unlawful employment, can lead to removal, visa revocation, and future inadmissibility.",
    examples: ["Working \"under the table\" for cash", "Any criminal arrest during your visit"],
    alternatives: ["Stay within the activities permitted for visitors", "Speak to an attorney immediately if you are arrested or charged"],
    citation: { name: "9 FAM 402.2-2(E) — unlawful activity while in visitor status", url: FAM_402_2 },
  },
  {
    id: "unlawful-presence-overview",
    title: "How unlawful presence is counted",
    appliesTo: ALL,
    severity: "medium",
    rule:
      "Unlawful presence generally begins the day after your authorized stay ends (your I-94 admit-until date, or day 90 for VWP). For B visitors, time while a timely, non-frivolous extension or change of status request is pending counts as a period of authorized stay for both the 3- and 10-year bars, provided you have not worked without authorization (VWP travelers cannot file one).",
    examples: ["Assuming a late extension request stops the clock", "Not knowing your last authorized day"],
    alternatives: ["Know your exact last day", "File any extension request before that day"],
    citation: { name: "9 FAM 302.11-3(B)(5) — unlawful presence; pending extension/change of status", url: FAM_302_11 },
  },
];

const RULES_BY_ID: Map<string, Rule> = new Map(VISITOR_RULES.map((r) => [r.id, r]));

/** Returns rules in the order of the input ids, skipping unknown ids. */
export function rulesById(ids: string[]): Rule[] {
  const out: Rule[] = [];
  for (const id of ids) {
    const rule = RULES_BY_ID.get(id);
    if (rule) out.push(rule);
  }
  return out;
}

/** Compact prompt text: one rule per line, `[id] title — rule (source: url)`, filtered by scope. */
export function rulesForPrompt(scope: RuleScope): string {
  return VISITOR_RULES.filter((r) => r.appliesTo.includes(scope))
    .map((r) => `[${r.id}] ${r.title} — ${r.rule.replace(/\s+/g, " ")} (source: ${r.citation.url})`)
    .join("\n");
}
