import { describe, it, expect } from "vitest";

const baseURL = "http://localhost:5000/api/orders";

describe("Orders API", () => {
  it("rejects order creation without authentication", async () => {
    const response = await fetch(baseURL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: [],
        shippingAddress: {},
      }),
    });

    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.success).toBe(false);
  });

  it("rejects fetching orders without authentication", async () => {
    const response = await fetch(baseURL);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.success).toBe(false);
  });

  it("rejects fetching a specific order without authentication", async () => {
    const response = await fetch(`${baseURL}/not-a-valid-id`);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.success).toBe(false);
  });
});