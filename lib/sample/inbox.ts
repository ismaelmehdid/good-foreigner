import type { InboxItem } from "@/lib/types";

// Fictional sample inbox for demo mode. All companies and people are made up.
// Expected verdicts (for demo sanity checks):
//   sample-1 paid feedback session → high/critical
//   sample-2 hackathon prize → gray (medium)
//   sample-3 unpaid conference invite → none/low
//   sample-4 Upwork contract from a U.S. client → high
//   sample-5 friend dinner → none
//   sample-6 home employer asks for remote days → gray/medium
//   sample-7 Airbnb checkout reminder → none
//   sample-8 "Vancouver resets your 90 days" → high (wrong advice)
export const SAMPLE_INBOX: InboxItem[] = [
  {
    id: "sample-1",
    source: "email",
    from: "Priya Raman <priya.raman@northwind-ai.example>",
    subject: "Paid feedback session — $150 for 45 minutes",
    date: "Mon, 28 Sep 2026 10:14:00 -0700",
    body: `Hi there,

Great meeting you at the Northwind AI developer night in San Francisco last Thursday! Your questions about agent tooling were some of the sharpest we heard all evening.

Our research team is running paid feedback sessions this week with developers who are actively building on our API. It's a 45-minute session at our SoMa office (or on Zoom if that's easier) where you'd walk us through your current workflow, try a couple of prototype features, and tell us what's broken.

We compensate participants $150 for their time. To get you set up for payment, please send your W-9 (or an invoice if you work through a company) to research-ops@northwind-ai.example before Friday, and pick a slot here: Tue 2pm, Wed 11am, or Thu 4pm.

Looking forward to it!

Priya Raman
UX Research Lead, Northwind AI`,
  },
  {
    id: "sample-2",
    source: "email",
    from: "BuildWeek SF Organizers <team@buildweek-sf.example>",
    subject: "Congrats! You placed 2nd — prize details inside",
    date: "Sun, 27 Sep 2026 21:40:00 -0700",
    body: `Hi team Good Foreigner,

Congratulations on placing 2nd overall at BuildWeek SF 2026! The judges loved your demo.

Your team has won a $3,000 cash prize, split evenly between team members. To release the funds, each member needs to complete a short winner form and a tax form (W-9 for U.S. persons, W-8BEN for non-U.S. persons) by October 9. Payments go out by bank transfer within 30 days.

Our sponsor, Lumen Cloud, has also asked whether you'd be open to a follow-up call next week about continuing the project with them. That part is entirely optional and separate from the prize.

Please reply to this email if you have any questions. Congrats again and thanks for building with us!

The BuildWeek SF Team`,
  },
  {
    id: "sample-3",
    source: "email",
    from: "DevSummit West <speakers@devsummit-west.example>",
    subject: "Invitation: join our panel on open-source AI (Oct 14, San Jose)",
    date: "Fri, 25 Sep 2026 09:02:00 -0700",
    body: `Hello,

We're putting together a community panel on open-source AI tooling at DevSummit West in San Jose on October 14, and a mutual contact suggested you'd be a great fit.

The panel is 40 minutes with three other builders, followed by 15 minutes of audience Q&A. This is a volunteer community slot, so there is no speaker fee, but we'll give you a complimentary full conference pass (a $700 value) and you're welcome to attend all three days of talks and workshops.

If you're interested, just reply with a short bio and a headshot by October 3 and we'll send the panel brief.

Thanks, and hope to see you there!

Marcus Webb
Community Program Manager, DevSummit West`,
  },
  {
    id: "sample-4",
    source: "email",
    from: "Upwork <notifications@upwork.example>",
    subject: "You have a new contract offer from Bayline Logistics Inc.",
    date: "Sat, 26 Sep 2026 15:31:00 -0700",
    body: `Hi,

Good news! Bayline Logistics Inc. (Oakland, CA, United States) has sent you a contract offer.

Contract: "Build an internal dashboard in Next.js for shipment tracking"
Type: Hourly, $65.00/hr, up to 30 hrs/week
Start date: September 30, 2026
Message from client: "Loved your profile. Since you're in the Bay Area right now, it would be great if you could also come by our office a couple of days a week for the first month to work with the ops team."

To accept this offer, review the terms and submit your tax information (W-9 or W-8BEN) in your account settings so payments can be released.

Accept offer · Decline offer

The Upwork Team`,
  },
  {
    id: "sample-5",
    source: "email",
    from: "Léa Martin <lea.martin@mailbox.example>",
    subject: "Dinner Thursday?",
    date: "Tue, 29 Sep 2026 18:22:00 -0700",
    body: `Hey!

So glad you're in town. A few of us are getting dinner on Thursday around 7:30 at that Burmese place on Clement Street, the one with the tea leaf salad you kept talking about. Tom and Aiko are coming too, and Aiko is bringing her new partner who apparently also just moved here.

After that we might grab a drink in the Richmond or just walk to Ocean Beach if the fog isn't too bad. No pressure if you're tired from the hackathon, but it would be really nice to catch up properly before you fly back.

Let me know if Thursday works, otherwise Saturday brunch is also an option!

Léa`,
  },
  {
    id: "sample-6",
    source: "email",
    from: "Jonas Becker <jonas.becker@kestrel-software.example>",
    subject: "Could you cover a few days remotely from SF?",
    date: "Tue, 29 Sep 2026 08:47:00 +0200",
    body: `Hi,

Hope the trip is going well! Quick question: the Q4 release slipped and we're short-handed next week. Would you be able to work remotely from San Francisco for three or four days (Oct 5–8) to help close out the payment module?

You'd stay on your normal salary here in Berlin, of course, so nothing changes on the payroll side. It would mostly be code reviews, a couple of standups (we can move them to your morning), and fixing the remaining bugs in the checkout flow.

If that doesn't work with your plans, no problem at all, just let me know by Thursday so I can find someone else.

Thanks a lot,
Jonas
Engineering Manager, Kestrel Software GmbH`,
  },
  {
    id: "sample-7",
    source: "email",
    from: "Airbnb <automated@airbnb.example>",
    subject: "Reminder: checkout tomorrow at 11:00 AM",
    date: "Wed, 30 Sep 2026 17:00:00 -0700",
    body: `Hi,

Just a reminder that your stay at "Sunny Mission studio near Dolores Park" ends tomorrow, Thursday, October 1. Checkout is at 11:00 AM.

Before you go, your host Daniel asks that you:
- Leave the keys in the lockbox and scramble the code
- Start the dishwasher if there are dirty dishes
- Take out any trash to the bins by the side gate
- Turn off the lights and the space heater

Once you've checked out, we'll ask you to leave a review. Reviews help the community and give your host feedback on their space.

Safe travels!

The Airbnb Team`,
  },
  {
    id: "sample-8",
    source: "email",
    from: "Sam Okafor <sam.okafor@mailbox.example>",
    subject: "Re: running out of days",
    date: "Wed, 30 Sep 2026 22:11:00 -0700",
    body: `Haha don't stress about the 90 days, I did this last year!

Just do a weekend in Vancouver before your time runs out. You fly up Friday, see the city, come back Sunday, and when you land the officer gives you a fresh 90 days. My cousin did the same thing with Tijuana and it was totally fine.

Honestly that way you can stay through Christmas and keep doing the freelance stuff for that Oakland startup while you look for a proper job. Flights to YVR are like $180 right now if you book this week.

Let me know if you want my friend's couch in Vancouver for the weekend.

Sam`,
  },
];
