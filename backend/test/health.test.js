import { describe, it, expect } from "vitest";

describe("Backend Health API", () => {
  it("returns a successful health response", async () => {
    const response = await fetch("http://localhost:5000/api/health");
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.message).toBe("E-commerce backend is running!");
  });
});