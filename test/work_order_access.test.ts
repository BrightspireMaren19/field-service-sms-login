import { describe, expect, it, vi } from "vitest";
import type { SmsGateway } from "../src/infrai_sms.js";
import { verifyTechnicianAndDispatch, type WorkOrder } from "../src/work_order_access.js";
import { MemoryWorkOrderStore } from "../src/dispatch_login_service.js";

describe("technician verification", () => {
  it("moves the assigned work order to technician_en_route and keeps its media context", async () => {
    const order: WorkOrder = {
      id: "WO-42",
      customerName: "Avery Chen",
      address: "42 Cedar Avenue",
      dispatchStatus: "access_pending",
      photos: [{ id: "p-7", caption: "Damaged meter", url: "https://example.test/meter.jpg" }],
      followUp: { note: "Record the new serial number", dueAt: "2026-08-15T12:00:00Z" },
    };
    const store = new MemoryWorkOrderStore(new Map([[order.id, order]]));
    const verify = vi.fn().mockResolvedValue({ verified: true });
    const sms = { verify, otp: vi.fn() } as unknown as SmsGateway;

    const result = await verifyTechnicianAndDispatch(sms, store, {
      phone: "+15551234567",
      code: "482913",
      requestId: "login-WO-42-1",
      workOrderId: "WO-42",
    });

    expect(result.outcome).toBe("dispatched");
    expect((await store.find("WO-42"))?.dispatchStatus).toBe("technician_en_route");
    expect((await store.find("WO-42"))?.photos[0]?.caption).toBe("Damaged meter");
    expect(verify).toHaveBeenCalledWith("+15551234567", "482913", "login-WO-42-1");
  });
});
