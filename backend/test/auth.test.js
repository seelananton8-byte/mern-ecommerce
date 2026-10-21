import "dotenv/config";
import { describe, it, expect } from "vitest";
import jwt from "jsonwebtoken";

const baseURL = "http://localhost:5000/api/auth";

const jwtSecret = process.env.JWT_SECRET;

describe("Authentication API", () => {
  it("rejects registration with invalid details", async () => {
    const response = await fetch(`${baseURL}/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "A",
        email: "invalid-email",
        password: "123",
      }),
    });

    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
  });

  it("rejects login with missing credentials", async () => {
    const response = await fetch(`${baseURL}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "",
        password: "",
      }),
    });

    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
  });

  it("rejects access to the current-user route without a token", async () => {
    const response = await fetch(`${baseURL}/me`);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.success).toBe(false);
  });

  it("logs in an existing user successfully", async () => {
    const response = await fetch(`${baseURL}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "demo.user101@example.com",
        password: "DemoPass123!",
      }),
    });

    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(typeof data.token).toBe("string");
    expect(data.token.length).toBeGreaterThan(0);
    expect(data.user.email).toBe("demo.user101@example.com");
    expect(data.user).not.toHaveProperty("password");
  });

  it("returns the current user with a valid token", async () => {
    const loginResponse = await fetch(`${baseURL}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "demo.user101@example.com",
        password: "DemoPass123!",
      }),
    });

    const loginData = await loginResponse.json();

    expect(loginResponse.status).toBe(200);
    expect(loginData.success).toBe(true);

    const meResponse = await fetch(`${baseURL}/me`, {
      headers: {
        Authorization: `Bearer ${loginData.token}`,
      },
    });

    const meData = await meResponse.json();

    expect(meResponse.status).toBe(200);
    expect(meData.success).toBe(true);
    expect(meData.user.email).toBe("demo.user101@example.com");
    expect(meData.user).not.toHaveProperty("password");
  });

  it("rejects an invalid token", async () => {
    const response = await fetch(`${baseURL}/me`, {
      headers: {
        Authorization: "Bearer invalid.token.value",
      },
    });

    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.success).toBe(false);
  });

  it("rejects an expired token", async () => {
    expect(
      jwtSecret,
      "Set JWT_SECRET in the .env file before running this test."
    ).toBeTruthy();

    const expiredToken = jwt.sign(
      { userId: "507f1f77bcf86cd799439011" },
      jwtSecret,
      { expiresIn: -1 }
    );

    const response = await fetch(`${baseURL}/me`, {
      headers: {
        Authorization: `Bearer ${expiredToken}`,
      },
    });

    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.success).toBe(false);
    expect(data.message).toMatch(/expired|invalid/i);
  });

  it("rejects a token with an invalid user ID", async () => {
    const token = jwt.sign({ userId: "invalid-user-id" }, jwtSecret, {
      expiresIn: "1h",
    });

    const response = await fetch(`${baseURL}/me`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.success).toBe(false);
  });
});

// Extra security tests
// login/register share a strict rate limiter (10 per 15 min).
// This block adds 4 requests. Restart the server before running if you get 429.
describe("Authentication API security", () => {
  const b64 = (obj) =>
    Buffer.from(JSON.stringify(obj)).toString("base64url");

  const callMe = (token) =>
    fetch(`${baseURL}/me`, { headers: { Authorization: `Bearer ${token}` } });

  const postLogin = (payload) =>
    fetch(`${baseURL}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

  it("rejects a token with alg=none", async () => {
    const noneToken = `${b64({ alg: "none", typ: "JWT" })}.${b64({
      userId: "507f1f77bcf86cd799439011",
      role: "admin",
    })}.`;

    const response = await callMe(noneToken);
    expect(response.status).toBe(401);
  });

  it("rejects a token signed with the wrong secret", async () => {
    const token = jwt.sign(
      { userId: "507f1f77bcf86cd799439011", role: "admin" },
      "totally-wrong-secret-key-1234567890",
      { algorithm: "HS256", expiresIn: "1h" }
    );

    const response = await callMe(token);
    expect(response.status).toBe(401);
  });

  it("rejects a token signed with a different algorithm (HS512)", async () => {
    const token = jwt.sign(
      { userId: "507f1f77bcf86cd799439011", role: "user" },
      jwtSecret,
      { algorithm: "HS512", expiresIn: "1h" }
    );

    const response = await callMe(token);
    expect(response.status).toBe(401);
  });

  it("rejects a valid token for a user that does not exist", async () => {
    const token = jwt.sign(
      { userId: "507f1f77bcf86cd799439011", role: "user" },
      jwtSecret,
      { algorithm: "HS256", expiresIn: "5m" }
    );

    const response = await callMe(token);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.success).toBe(false);
  });

  it("rejects a register password longer than 72 bytes", async () => {
    const response = await fetch(`${baseURL}/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Long Pass",
        email: `long.${Date.now()}@example.com`,
        password: "a".repeat(80),
      }),
    });

    expect(response.status).toBe(400);
  });

  it("returns the same error for wrong password and unknown email", async () => {
    const wrongPassword = await postLogin({
      email: "demo.user101@example.com",
      password: "WrongPass123!",
    });
    const unknownEmail = await postLogin({
      email: "nobody.here@example.com",
      password: "WrongPass123!",
    });

    const wrongPasswordData = await wrongPassword.json();
    const unknownEmailData = await unknownEmail.json();

    expect(wrongPassword.status).toBe(401);
    expect(unknownEmail.status).toBe(401);
    expect(wrongPasswordData.message).toBe(unknownEmailData.message);
  });

  it("rejects NoSQL injection in login", async () => {
    const response = await postLogin({
      email: { $ne: null },
      password: { $ne: null },
    });

    expect(response.status).toBe(400);
  });
});