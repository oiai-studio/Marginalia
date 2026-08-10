# Writing style guide

## The hard constraints

1. **No em dashes, ever.** Anywhere an em dash feels right, a comma, colon, full stop, semicolon, or parentheses reads just as well. This includes en dashes used as em dashes. Hyphenated compounds are fine.
2. **No "not just X, but Y" or "not X, but Y".** If you need contrast, write it plainly: "It's a rethinking, not a redesign."
3. **Sentence case headings.** "Writing style guide", not "Writing Style Guide". Proper nouns are the only exception.
4. **Straight quotes and apostrophes**, not curly. No non-breaking spaces.
5. **Don't restate at the end.** No "In summary", "In conclusion". Stop when the thing is said.
6. **Vary sentence length.** If three sentences in a row are roughly the same length and shape, rewrite at least one.



## Banned words and phrases

- **Promotional:** world-class, cutting-edge, best-in-class, seamlessly, robust, leverage (as a verb), unlock, empower, unleash, delve into, dive deep, journey (as metaphor), ecosystem (unless literally one), holistic, bespoke, meticulously crafted.
- **Significance puffery:** stands as a testament, plays a pivotal/crucial/vital role, serves as a reminder, underscores the importance, reflects broader trends, marks a turning point, evolving landscape, indelible mark, deeply rooted, at the heart of, cornerstone of, paving the way, in today's fast-paced world.
- **The "-ing" tack-on:** a participle gesturing at a vague consequence after a comma. Cut everything after the comma unless you have evidence, then write the consequence as its own sentence.
- **Vague attribution:** "Experts agree", "Studies have shown". Name the expert, the study, the year, or remove the claim.
- **Hedge soup:** "may potentially help support". One honest hedge, not two.



## Other tells to cut

- **The deferred specific:** a category noun (ways, things, changes, moments, signs) that promises a concrete detail and never delivers.
- **Sensory-abstraction blends:** an abstract noun smuggled in beside a physical one. Smells, tastes, and sounds attach to physical things only.
- **Rule of three** with a weak filler third item. If you have two real things and a filler, write two.
- **Elegant variation:** swapping synonyms to avoid repeating a word. Humans repeat the word when it's the right word.
- **Bold on every other line.** One phrase per section, max.



## Headings

Write headings as single-sentence claims, not topic labels. Each carries the "so what", aim for twelve words or fewer, apply the squint test. One sentence each, no full stops mid-heading.

## Other house habits

- British English spellings throughout.
- Concrete nouns and active verbs.
- Lists for parallel items only.
- Short paragraphs, two to four sentences as a default, varied.
- Use the project's own words over generic industry vocabulary.
- Match the request length.
- Don't invent quotes, statistics, or names.



---

# UI writing style guide

Internal scaffolding. The mechanics below are settled; the word list is a first stab and needs the team's refinement.

## Mechanics

The rules that stop drift. Follow them without thinking about them.

### Capitalisation

**Title case on buttons and links.** Action labels on `Button`, link-styled actions (`variant="link"`, text links, breadcrumb ancestors), and primary navigation items. Capitalise each principal word.

- Yes: "Create New Invoice", "View Audit Plan", "Learn More"
- No: "Create new invoice", "View audit plan", "Learn more"

**Sentence case everywhere else.** Page titles, section headings, form labels, table column headers, tabs, empty states, error messages, tooltips, modal titles. Capitalise the first word and proper nouns only.

- Yes: "Delete this workspace?"
- No: "Delete This Workspace?"

Product and feature names are proper nouns only if we've decided they are. In sentence-case copy, default to lowercase for feature names unless there's a reason. "Export the report", not "Export the Report". On a button or link, that becomes "Export the Report" only when "the" is mid-label; prefer the shorter verb-first form ("Export Report").

Acronyms stay uppercase: API, CSV, PDF, VAT.

### Punctuation

- **No full stops** on labels, buttons, headings, tooltips, or single-sentence help text.
- **Full stops** on body copy, error messages, and anything two sentences or longer. If one sentence in a group gets a full stop, they all do.
- **No exclamation marks.** Not in success messages, not in empty states.
- **Serial comma** on: "name, email, and role".
- **Straight quotes and apostrophes**, not curly.
- **No em dashes.** Use a comma, colon, or full stop.
- **Ellipses** only for a truncated string or an action that opens a further step ("Import from File...").
- **Ampersands** only where space genuinely forces it. Otherwise "and".



### Voice and grammar

- **Second person.** "Your account", not "My account" or "The user's account".
- **Active voice.** "We couldn't save your changes", not "Your changes could not be saved".
- **Present tense.** "Your invoice sends on 1 August", not "will send".
- **Contractions.** "Can't", "won't", "you'll". They read faster and sound less officious.
- **No gendered pronouns.** "They" is fine as a singular.



### Numbers, dates, times

British English spelling throughout (`organisation`, `licence`, `colour`).

- **Numerals for everything**, including one to nine. "3 users", not "three users".
- **Dates (UI / tables):** day first, abbreviated month, no leading zero. 1 Aug 2026, not 01 Aug 2026.
- **Dates (body copy):** 1 August 2026.
- **Slash dates:** avoid 01/08/26. When a numeric date is needed (forms, exports, placeholders), use DD/MM/YYYY.
- **Times:** default to 24-hour, 14:30. Show the timezone only when it could differ from the user's.
- **Ranges:** use "to", not a dash. "9:00 to 17:00".
- **Currency:** £1,200. No trailing .00 unless pence are meaningful.
- **Large numbers:** comma thousands separator from 1,000 up.
- **File sizes:** 2.4 MB, space before the unit.



### Buttons and actions

- **Title case** (see Capitalisation). "Save Changes", not "Save changes".
- **Verb first, and name the actual action.** "Save Changes", "Delete Workspace", "Send Invite". Not "OK", not "Submit", not "Yes".
- **Two to three words.** If it needs more, the surrounding copy is doing too little.
- **The button should complete the sentence in the heading.** Heading "Delete this workspace?" pairs with button "Delete Workspace".
- **Cancel is always "Cancel".** Never "Nevermind", never "Go back".
- **Destructive actions name the object.** "Delete 4 Invoices", not "Delete".



### Form labels and help text

- **Labels are nouns, sentence case, no full stop, no colon.** "Email address", not "Email Address:".
- **Never rely on placeholder text as the label.** Placeholders show format examples only: "e.g. ACME-2026-001".
- **Help text sits below the field**, is one sentence, and explains the constraint or the why. "We'll only use this to send delivery updates."
- **Mark the minority with words, not asterisks.** When most fields are required, mark only optional ones as `(optional)`. When most are optional, mark only required ones as `(required)`. Do not mark both. FormArchetype uses `marking="optional" | "required"` — see `forms.md`.
- **Don't repeat the label in the help text.**



### Error messages

Formula: **what happened, then what to do about it.** No blame, no apology, no "oops".

- Yes: "That email address is already in use. Try signing in instead."
- No: "Error: Invalid input."
- No: "Sorry, something went wrong!"

Field-level errors sit under the field and name the fix: "Enter a date after 1 Aug 2026." System errors name the system state and the retry: "We couldn't reach the server. Try again in a moment."

Never expose error codes to users without a plain-English sentence alongside.

### Empty states

Say what goes here and give the action. "No invoices yet. Create your first invoice to get started." Skip the illustration-and-jokes routine; this is a work tool.

### Success and confirmation

Confirm the specific thing that happened, then stop. "Invoice sent to [laura@example.com](mailto:laura@example.com)." Not "Success!" Not "Your invoice has been successfully sent!"

### Tone

Plain, calm, and slightly brisk. The person using this is at work and wants to leave. No jokes in error states, no personality in destructive confirmations, no "Great news!". Warmth comes from being clear, not from being chatty.

## Word list

### Pick one and stick to it


| Use                | Not                                 | Note                                                                                                                                                                                                                                      |
| ------------------ | ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Sign in / sign out | Log in, login, log out, logout      | "Login" as a noun is a different word from "log in" the verb. Avoid both. As button/link labels: "Sign In" / "Sign Out".                                                                                                                  |
| Sign up            | Register, create an account         |                                                                                                                                                                                                                                           |
| Delete             | Remove, destroy, trash              | Delete is permanent. See below.                                                                                                                                                                                                           |
| Remove             | Delete                              | Remove takes something out of a list or group; the thing still exists.                                                                                                                                                                    |
| Archive            | Deactivate, hide                    |                                                                                                                                                                                                                                           |
| Account            | Profile, my account                 | The billing and identity entity.                                                                                                                                                                                                          |
| Workspace          | Team, org, organisation, tenant     | **Needs a decision.** Pick the one that matches the data model.                                                                                                                                                                           |
| Member             | User, seat, teammate                | People inside a workspace. "User" is for internal docs only.                                                                                                                                                                              |
| Admin              | Administrator, owner, superuser     |                                                                                                                                                                                                                                           |
| Settings           | Preferences, options, configuration |                                                                                                                                                                                                                                           |
| Edit               | Update, modify, change              |                                                                                                                                                                                                                                           |
| Save               | Apply, confirm, submit              |                                                                                                                                                                                                                                           |
| Send               | Submit, dispatch                    |                                                                                                                                                                                                                                           |
| Upload             | Import, attach, add file            | Upload moves a file in. Import parses data out of a file.                                                                                                                                                                                 |
| Export             | Download, extract                   | Export generates a file. Download retrieves an existing one.                                                                                                                                                                              |
| Search             | Find, filter, lookup                | Search is free text. Filter narrows an existing set.                                                                                                                                                                                      |
| Filter             | Refine, narrow                      |                                                                                                                                                                                                                                           |
| Invite             | Add member, share access            |                                                                                                                                                                                                                                           |
| Permissions        | Access, rights, privileges          |                                                                                                                                                                                                                                           |
| Role               | Permission level, access level      |                                                                                                                                                                                                                                           |
| Draft              | Unpublished, in progress, WIP       |                                                                                                                                                                                                                                           |
| Published          | Live, active, released              |                                                                                                                                                                                                                                           |
| Required           | Mandatory, compulsory               |                                                                                                                                                                                                                                           |
| Optional           | Not required                        |                                                                                                                                                                                                                                           |
| Error              | Failure, problem, issue             |                                                                                                                                                                                                                                           |
| Attention          | Warning, alert                      | Reserve "warning" for genuine risk. Component note: Badge `tone="warning"` is the **colour** for risk/attention status (overdue, Major NC); the **label copy** can still say "Attention" or "To schedule" — tone ≠ the word on the badge. |




### Words to avoid entirely

- **Please.** "Please enter your email" is padding. "Enter your email."
- **Sorry / oops / whoops / uh-oh.** Fix the problem, don't perform contrition.
- **Simply / just / easily / quickly.** If it were simple they wouldn't be reading the help text.
- **Utilise, leverage, facilitate, enable.** Use, use, help, let.
- **Powerful, seamless, robust, intuitive, world-class.** Marketing words in a form. No.
- **Click / tap.** Say "select" or name the action. Half your users are on a different input device.
- **Invalid, illegal, forbidden.** Say what's wrong instead.
- **Are you sure?** Ask a real question: "Delete this workspace? This can't be undone."
- **Successfully.** If it says the thing happened, it happened.
- **Terminate, purge, execute.** You're not writing a manpage.
- **AI-powered.** Only if it's load-bearing information for the user's decision.



### Delete vs remove vs archive

Worth getting right early, because the UI has to match the behaviour.

- **Delete:** gone, unrecoverable. Always needs a confirmation that names the object and says it can't be undone.
- **Remove:** taken out of this context, still exists elsewhere. Removing a member from a workspace doesn't delete their account. No confirmation needed if it's cheap to reverse.
- **Archive:** hidden from the default view, recoverable, still counted. Say where it goes: "Archived invoices stay in Filters > Archived."

If the interface says "delete" and the backend soft-deletes, one of the two is lying. Pick.

