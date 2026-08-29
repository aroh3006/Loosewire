# Example projects

These are small sample projects you can upload to Loosewire to see what a scan
looks like without writing any code yourself. Each one is ready to drop
straight into the upload box at https://loosewire.onrender.com. Three of them
are zipped source projects. Two are Android APKs for trying the APK path.

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
sends without comparing it to the amount calculated when the order was created.
A buyer can pay far less than the ticket price and still have the order marked
paid.

Scanning this returns two findings. Both are high severity. Both point at the
same function for two different reasons.

## fdroid-privileged-extension.apk

A real, compiled Android app for trying the APK path rather than the zip path.
Uploading it makes the server decompile the APK with jadx first. It then scans
the recovered source. That is a different code path from a zip upload.

Scanning this returns no findings. The app has nothing to do with payments. A
clean result is the correct one here. The point of this example is the
pipeline rather than the findings. It shows that extraction, decompilation and
scanning all work on a genuine compiled app. The scan reports 56 files
inspected, even though the APK itself holds only twelve entries. Those extra
files are what jadx recovered from the single dex file inside.

This app is F-Droid Privileged Extension, an open source helper published by
the F-Droid project. It is not written by us. It is included here unmodified,
purely as a known-good APK to scan.

    Name:    F-Droid Privileged Extension
    Version: 2130
    Source:  https://gitlab.com/fdroid/privileged-extension
    Listing: https://f-droid.org/en/packages/org.fdroid.fdroid.privileged/
    License: Apache License 2.0

The Apache License 2.0 allows redistribution. The file is bundled exactly as
downloaded from F-Droid, with no changes of any kind.

## exposed-key-demo.apk

The APK counterpart to the broken zips. This one triggers a real finding.

Be clear about what this file is. It is not a separate app. It is a repackaged
copy of the same F-Droid Privileged Extension described above, with one small
file added on purpose. Nothing else about the app was touched. The added file
is `assets/demo/checkout-config.js`, a short piece of throwaway JavaScript
holding a hardcoded key:

    var gatewayApiSecretKey = "gwk_demo_4TnQ8xLm2VbW7ZcR5HdY9KsP";

That value is invented for this example. It is not a credential for anything.
It does not open any account and it is not tied to any real service.

Scanning this returns one critical finding from the exposed secret key rule.
The rule treats a key sitting in a file that ships inside the app as worse
than one in backend code, because anyone can pull an APK apart and read it.
That is the whole point of the example. The key is invisible in the packaged
app. It falls straight out once the file is decompiled.

The repackaging was done with apktool. The result was signed with jarsigner
using a throwaway self-signed key made for this purpose. It is a valid signed
APK. It decompiles cleanly. The signing key is a local demo key with no
meaning outside these examples.

This modified copy is redistributed under the same Apache License 2.0 as the
original. The license permits changes as long as they are stated. This section
is that statement. Do not treat this file as the real F-Droid app. Use the
unmodified `fdroid-privileged-extension.apk` above if that is what you want.

## Trying them out

Download the file you want. Open the live app and drop it into the upload box
on the Scan view. The findings appear on the Findings view once the scan
finishes. Nothing is kept on the server afterward.

An APK scan takes longer than a zip scan. The server has to decompile the app
before it can read any code. Around half a minute is normal.

Between the three zips these examples cover all four checks the tool runs. You
can see every rule fire without needing a project of your own. The two APKs
cover the other half of the tool, the path that handles compiled Android apps.
One of them scans clean. The other one does not.
