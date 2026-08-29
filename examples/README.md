# Example projects

These are small sample projects you can upload to Loosewire to see what a scan
looks like without writing any code yourself. Each one is zipped and ready to
drop straight into the upload box at https://loosewire.onrender.com.

These are separate from the `fixtures` folder at the root of the repo. Fixtures
are used by the automated test suite and the evaluation numbers. These examples
exist only for people trying the tool by hand.

## clean-store.zip

A small Express storefront that does the payment wiring correctly. It verifies
the gateway signature before it marks an order paid. It compares the confirmed
amount against the amount worked out when the order was created. It reads the
signing secret from an environment variable rather than hardcoding it.

Scanning this returns no findings. Use it to see what a passing scan looks like,
and to confirm the tool is not simply flagging every project it is given.

## open-webhook.zip

A subscription billing service with two real problems.

The first is a webhook route at `/gateway/webhook` that acts on whatever payload
arrives. It activates a subscription on an `invoice.paid` event without ever
checking a signature header. Anyone who knows the URL can mark any
subscription as active for free.

The second is a live secret key hardcoded into `public/billing.js`. That file is
served straight to the browser. The key therefore ships to every visitor.

Scanning this returns two findings, one critical and one high.

## trusting-checkout.zip

A Flask ticket shop with a single order completion route that trusts the client
completely.

The route at `/orders/<order_id>/complete` marks the order paid with no
signature check anywhere in its body. It also stores whatever amount the request
sends without comparing it to the amount calculated when the order was created,
so a buyer can pay far less than the ticket price and still have the order
marked paid.

Scanning this returns two findings. Both are high severity. Both point at the
same function for two different reasons.

## Trying them out

Download the zip you want. Open the live app and drop the file into the upload
box on the Scan view. The findings appear on the Findings view once the scan
finishes. Nothing is kept on the server afterward.

Between the three of them these examples cover all four checks the tool runs.
You can see every rule fire without needing a project of your own.
