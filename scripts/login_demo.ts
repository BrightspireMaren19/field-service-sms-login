const baseUrl = process.env.SERVICE_URL ?? "http://localhost:3000";
const phone = process.env.TECHNICIAN_PHONE;
if (!phone) throw new Error("TECHNICIAN_PHONE is required");

const requestId = `field-login-${Date.now()}`;
const response = await fetch(`${baseUrl}/login/code`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ phone, requestId }),
});
const result = await response.json();
console.log(result);

export {};
