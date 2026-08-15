import type { SmsGateway } from "./infrai_sms.js";

export type WorkOrder = {
  id: string;
  customerName: string;
  address: string;
  dispatchStatus: "access_pending" | "technician_en_route";
  photos: Array<{ id: string; caption: string; url: string }>;
  followUp: { note: string; dueAt: string } | null;
};

export type WorkOrderStore = {
  find(id: string): Promise<WorkOrder | undefined>;
  save(workOrder: WorkOrder): Promise<void>;
};

export async function requestTechnicianCode(
  sms: SmsGateway,
  phone: string,
  requestId: string,
) {
  await sms.otp(phone, requestId);
  return { phone, delivery: "code_sent" as const };
}

export async function verifyTechnicianAndDispatch(
  sms: SmsGateway,
  store: WorkOrderStore,
  input: { phone: string; code: string; requestId: string; workOrderId: string },
) {
  await sms.verify(input.phone, input.code, input.requestId);
  const workOrder = await store.find(input.workOrderId);
  if (!workOrder) return { outcome: "work_order_not_found" as const };

  const dispatched: WorkOrder = {
    ...workOrder,
    dispatchStatus: "technician_en_route",
  };
  await store.save(dispatched);
  return { outcome: "dispatched" as const, workOrder: dispatched };
}
