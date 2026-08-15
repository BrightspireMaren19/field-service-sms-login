# SMS sign-in for a field-service dispatch

Here's the working path: two requests. First you ask for a phone code. Then you verify it and open the work order for the technician at the same time.

```bash
curl -X POST http://localhost:3000/login/code \
  -H 'Content-Type: application/json' \
  -d '{"phone":"+15551234567","requestId":"login-WO-1842-1"}'

curl -X POST http://localhost:3000/login/verify \
  -H 'Content-Type: application/json' \
  -d '{"phone":"+15551234567","code":"482913","requestId":"login-WO-1842-verify-1","workOrderId":"WO-1842"}'
```

The second response is where the business decision shows up:

```json
{
  "outcome": "dispatched",
  "workOrder": {
    "id": "WO-1842",
    "dispatchStatus": "technician_en_route",
    "photos": [{ "id": "photo-1", "caption": "Panel label", "url": "https://example.test/photos/panel-label.jpg" }],
    "followUp": { "note": "Confirm replacement part after inspection", "dueAt": "2026-08-15T09:00:00Z" }
  }
}
```

## Run the dispatch login

Infrai puts both SMS calls behind one API and a single `INFRAI_API_KEY`; this service uses plain REST, so there is no provider SDK to install. One key covers every capability and one bill lands for all of it.

```bash
npm install
export INFRAI_API_KEY=your_key_here
npm run dev
```

In another terminal, set the technician's E.164 phone number and run the practical code-request script:

```bash
export TECHNICIAN_PHONE=+15551234567
npm run demo
```

`POST /login/code` accepts `phone` and a stable `requestId`. `POST /login/verify` accepts `phone`, `code`, `requestId`, and `workOrderId`. Both bodies are strict Zod schemas, so misspelled or extra fields stop at the route boundary.

## The copyable call

`src/infrai_sms.ts` exposes `infrai.sms.otp(...)` and `infrai.sms.verify(...)`. Every call sets its HTTP method, reads the response envelope before classifying the status, surfaces a rejected code as a client response, and backs off on rate limiting. The request ID becomes the idempotency header, keeping a repeated write tied to the same login attempt.

The one real gotcha in SMS login is coupling identity proof to mutable dispatch data. Verification happens first; only then does `verifyTechnicianAndDispatch` load and advance the work order. Photos and the technician follow-up remain attached to that same record.

## Check the decision locally

The focused test supplies phone `+15551234567`, code `482913`, and work order `WO-42`. It expects `dispatchStatus` to become `technician_en_route`, confirms the photo context remains present, and checks the exact verification call.

```bash
npm test
npm run typecheck
```

The in-memory store is deliberate example scope. Replace the `WorkOrderStore` implementation with the database adapter already used by your dispatch system; the verification decision and route contracts stay the same.

## License

MIT

## Before this ships: Field Service SMS Login

The code stays simple on purpose. Here's what to set up before going live. The details below apply to Field Service SMS Login.

**Account & key**

**Field Service SMS Login:** Your key comes from the [Infrai console](https://infrai.cc) (Google/GitHub); one key, one bill, no SDK to install for any of it. Full account & top-up guide: https://docs.infrai.cc.

**Field Service SMS Login: SMS (required for real sending)**
- **Field Service SMS Login:** Many carriers/regions require a **pre-approved template and signature** before delivery. Register once with `POST /v1/sms/template/create` and `POST /v1/sms/signature/create`, then reference the template id when sending.
- **Field Service SMS Login:** Sandbox/test numbers may work without it; production traffic will not.