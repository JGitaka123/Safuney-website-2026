# Email DNS: adding a DMARC record for safuney.com

**For:** whoever has the cPanel login for `eac3.host-ww.net`. About 10 minutes, then a check two
weeks later.

## Why

Sign-in codes, receipts and order alerts are sent from `no_reply@safuney.com` through the cPanel
mailbox. Mail providers like Gmail and Outlook look at three DNS records to decide whether mail
really comes from safuney.com:

| Record | What it says | safuney.com |
| ------ | ------------ | ----------- |
| SPF | Which servers may send for the domain | Present |
| DKIM (`default._domainkey`) | A signature that proves a message wasn't changed | Present |
| DMARC (`_dmarc`) | What to do with mail that fails the other two, and where to send reports | **Missing** |

Without DMARC, our mail is more likely to land in spam, and anyone can send mail pretending to be
safuney.com. Since February 2024, Gmail and Yahoo expect it from domains that send a lot of mail.

The domain's DNS is managed in cPanel (its nameservers are the host's), so the record goes there.

## Step 1: add the record (monitoring only)

This first version only asks for reports. It doesn't block anything, so it can't stop any mail from
arriving.

1. Sign in to cPanel.
2. Open **Domains → Zone Editor**.
3. On the `safuney.com` row, click **Manage**.
4. Click **+ Add Record** and choose **Add TXT Record**. (Some cPanel versions show a form with a
   **Type** list instead: choose **TXT**.)
5. Fill in:
   - **Name:** `_dmarc.safuney.com.` (cPanel may fill in the domain part for you; the record must end
     up as `_dmarc.safuney.com`)
   - **TTL:** leave the default (usually 14400)
   - **Record:**
     ```
     v=DMARC1; p=none; rua=mailto:info@safuney.com; fo=1
     ```
6. Click **Save Record**.

What the parts mean:

- `p=none`: take no action yet, just report.
- `rua=mailto:info@safuney.com`: where the daily summary reports go. Use any mailbox someone reads.
  A dedicated `dmarc@safuney.com` keeps the reports out of the main inbox.
- `fo=1`: report a failure even when only one of SPF or DKIM fails.

## Step 2: check it worked

Allow up to an hour, then use either:

- **cPanel → Email → Email Deliverability.** `safuney.com` should show no DMARC problem. This page
  checks SPF and DKIM too.
- **A web checker:** search for "MXToolbox DMARC lookup" and enter `safuney.com`. It should find the
  record and show `p=none`.

Then send a test sign-in code from the site to a Gmail address. In Gmail, open the message →
**⋮ → Show original**. SPF, DKIM and DMARC should all say **PASS**.

## Step 3: two weeks later, start enforcing

Reports arrive at the `rua` mailbox as small zipped XML attachments, roughly daily, from Google,
Microsoft and others. They're hard to read raw. A free DMARC report viewer makes them readable, or
forward a few to the developer.

Before tightening, make sure everything that legitimately sends as `@safuney.com` passes. That covers
the website and staff mailboxes on cPanel, plus any newsletter tool or invoicing system. Anything
sending from somewhere else has to be added to SPF and set up for DKIM first, or its mail will start
going to spam.

When the reports show only our own servers passing:

1. Zone Editor → `_dmarc` record → **Edit**, and change `p=none` to `p=quarantine`:
   ```
   v=DMARC1; p=quarantine; rua=mailto:info@safuney.com; fo=1
   ```
   Failing mail now goes to spam rather than the inbox.
2. After another month with no surprises, you can change it to `p=reject` (failing mail is refused
   outright). This step is optional; `quarantine` already does most of the work.

## If something goes wrong

If staff or customers say mail from safuney.com suddenly goes to spam after a change, set the record
back to `p=none`. That undoes the effect as soon as DNS updates, usually within the TTL (a few hours).
