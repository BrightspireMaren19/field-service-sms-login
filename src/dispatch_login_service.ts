import express from "express";
import { z } from "zod";
import { InfraiError, infrai } from "./infrai_sms.js";
import {
  requestTechnicianCode,
  verifyTechnicianAndDispatch,
  type WorkOrder,
  type WorkOrderStore,
} from "./work_order_access.js";

const phone = z.string().regex(/^\+[1-9]\d{7,14}$/);
const requestCodeBody = z.object({
  phone,
  requestId: z.string().min(8).max(100),
}).strict();
const verifyCodeBody = z.object({
  phone,
  code: z.string().regex(/^\d{4,8}$/),
  requestId: z.string().min(8).max(100),
  workOrderId: z.string().min(1).max(80),
}).strict();

export class MemoryWorkOrderStore implements WorkOrderStore {
  private readonly orders: Map<string, WorkOrder>;
  constructor(orders = new Map<string, WorkOrder>()) { this.orders = orders; }
  async find(id: string) { return this.orders.get(id); }
  async save(order: WorkOrder) { this.orders.set(order.id, order); }
}

export function createDispatchLoginService(store: WorkOrderStore) {
  const service = express();
  service.use(express.json({ limit: "16kb" }));

  service.post("/login/code", async (request, response) => {
    const parsed = requestCodeBody.safeParse(request.body);
    if (!parsed.success) {
      response.status(400).json({ error: "invalid_request", issues: parsed.error.issues });
      return;
    }
    try {
      const sms = { otp: infrai.sms.otp, verify: infrai.sms.verify };
      response.status(202).json(await requestTechnicianCode(sms, parsed.data.phone, parsed.data.requestId));
    } catch (error) {
      sendServiceError(response, error);
    }
  });

  service.post("/login/verify", async (request, response) => {
    const parsed = verifyCodeBody.safeParse(request.body);
    if (!parsed.success) {
      response.status(400).json({ error: "invalid_request", issues: parsed.error.issues });
      return;
    }
    try {
      const sms = { otp: infrai.sms.otp, verify: infrai.sms.verify };
      const result = await verifyTechnicianAndDispatch(sms, store, {
        phone: parsed.data.phone!,
        code: parsed.data.code!,
        requestId: parsed.data.requestId!,
        workOrderId: parsed.data.workOrderId!,
      });
      response.status(result.outcome === "dispatched" ? 200 : 404).json(result);
    } catch (error) {
      sendServiceError(response, error);
    }
  });
  return service;
}

function sendServiceError(response: express.Response, error: unknown) {
  if (error instanceof InfraiError) {
    response.status(error.status >= 400 && error.status < 500 ? error.status : 502).json({
      error: error.detail.code ?? "sms_rejected",
      message: error.message,
    });
    return;
  }
  response.status(502).json({ error: "sms_service_error" });
}

const seed: WorkOrder = {
  id: "WO-1842",
  customerName: "Morgan Lee",
  address: "18 Market Street",
  dispatchStatus: "access_pending",
  photos: [{ id: "photo-1", caption: "Panel label", url: "https://example.test/photos/panel-label.jpg" }],
  followUp: { note: "Confirm replacement part after inspection", dueAt: "2026-08-15T09:00:00Z" },
};

if (process.env.NODE_ENV !== "test") {
  const port = Number(process.env.PORT ?? 3000);
  createDispatchLoginService(new MemoryWorkOrderStore(new Map([[seed.id, seed]])))
    .listen(port, () => console.log(`Dispatch login listening on http://localhost:${port}`));
}
