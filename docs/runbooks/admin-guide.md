# Running the Safuney website

**For:** the people at Safuney who use the site day to day. No technical knowledge assumed. If a
sentence here needs explaining, that is a fault in the sentence.

You sign in at **safuney.com/sign-in/staff** with your work email, your password, and a six-digit code
from an authenticator app on your phone. The code changes every thirty seconds. If you lose the phone,
an administrator has to create your account again — the code cannot be recovered.

Everyone sees only the parts of the site their job needs. If a page says you do not have permission,
that is not a fault; ask an administrator.

---

## The desks

| You are | You use | For |
| ------- | ------- | --- |
| Sales | `/sales`, `/admin/customers`, `/admin/leads` | Pricing quotes, customer records, enquiries |
| Warehouse | `/warehouse` | Picking, packing, dispatching, delivering |
| Finance | `/sales/credit`, `/admin/orders` | Credit decisions, settling invoices, credit notes |
| Administrator | all of it, plus `/admin/catalogue`, `/admin/staff`, `/admin/flags` | Products, prices, staff, features |

---

## Every day

### The warehouse board — `/warehouse`
Four columns, left to right, in the order work happens.

1. **To pick** — the order is paid, or it is cash or invoice and confirmed. Open it, print the pick
   list, tick items into the box.
2. **Packed** — press *Mark packed* when everything on the list is in the box. The customer is told
   automatically.
3. **Out for delivery** — press *Dispatch*, and enter the rider's name and phone. The customer gets
   both, by text.
4. **Delivered** — enter who received it. For a cash order, enter the amount collected and the M-Pesa
   reference before you can mark it delivered.

**Stock comes off the system once**, at the right moment: when the customer paid, for M-Pesa and card
orders; when the rider leaves, for cash and invoice orders. You do not have to think about it.

### Enquiries — `/admin/leads`
Everything from the contact form, quote requests and the planner. Press *Mark handled* when someone has
replied, so the next person does not reply again.

---

## Money

### Someone paid an invoice — `/admin/orders`
Find the order, scroll to **Finance**, choose the invoice, enter the bank or M-Pesa reference the money
arrived with, and press *Mark settled*.

**This matters more than it looks.** Until an invoice is marked settled, the customer's account still
shows the money as owing. Let enough of them build up and the account stops being allowed to order on
credit at all.

### Money arrived outside the site
A bank transfer, cash at the depot, a paybill entry that never reached us. Same panel, *Record a
payment*. Enter the amount and the reference. The same reference cannot be recorded twice against one
order — that is deliberate.

### A customer is owed money back
*Issue a credit note*. Enter the amount and say why; the reason appears on the document. You cannot
credit more than the order was worth.

---

## Products and prices — `/admin/catalogue`

### Changing one price
Type the new price in the row and press *Save*. It is live within seconds. Every change is recorded
with your name against it.

### Changing a lot of them
Do not do it one at a time. See **[the catalogue guide](./catalogue-import.md)**.

### A stock count
Type what you counted and why, then *Save*. If some of that stock is already reserved for orders that
have not gone out yet, the system will not let you count below that number, and it will tell you what
the number is.

### Making a product visible to customers
New products start hidden, marked **Needs review**. Press *Needs review — publish* when the name, the
description and the price are all right. **Nothing hidden is ever shown to a customer**, and nothing
appears in Google either.

---

## Customers

`/admin/customers` lists organisations with their credit limit, terms and price list.

Credit applications are decided at **`/sales/credit`** by finance. An organisation that is more than
fifteen days past due on an invoice stops being supplied on credit automatically — it can still pay by
M-Pesa, card or cash, and the site tells the customer exactly which invoice is the problem. Settling
that invoice lifts it.

---

## Content — `/admin/content`

Pages you can write yourself, at their own address (`/safety-data-sheets`, say). Write it, tick
**Visible to customers**, save. Leave the tick off to keep it as a draft.

**Reviews** wait here until someone reads them. Nothing a customer writes appears on a product until you
publish it. *Verified buyer* means it came from an account that actually had that product delivered.

---

## Staff — `/admin/staff` (administrators only)

Adding someone: enter their email, pick their role, set a first password, press *Create account*. **The
authenticator code appears once.** Have them scan it into their phone there and then — you cannot get it
back, and without it they cannot sign in.

When someone leaves, untick *Can sign in*. Do not delete them: their name is on the orders they handled.

You cannot change your own role or switch off your own account, and the last administrator cannot be
demoted. That is deliberate.

---

## Features — `/admin/flags` (administrators only)

Extra features that are switched off until you decide otherwise: the product advisor, the hygiene
planner, the compliance hub, the phone app, live stock, volume tiers, rep visits.

Switching one on makes it live for every customer **immediately**. Look at it yourself first. Switching
it off makes it disappear completely, not just hide the link.

---

## When something looks wrong

- **A customer says they paid and the order says they have not.** Open the order and look at
  **Payments**. If nothing is there, the money did not reach us — ask for their M-Pesa message and check
  the reference. If it is there and says failed, the amount did not match; the history says what was
  paid and what was expected.
- **Stock looks wrong.** Look at the product's stock column: *reserved* is stock held for orders that
  have not gone out. A count that seems too low usually has orders behind it.
- **Someone cannot sign in.** Their phone's clock. Authenticator codes are time-based, and a phone a
  minute out generates codes the site rejects.
- **Anything else.** `/admin/audit` shows every change anyone made through the console, with who and
  when, most recent first.
