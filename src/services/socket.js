import { io } from "socket.io-client";
import { SOCKET_URL, getToken } from "./api";

let socket = null;

/* JWT-authenticated socket for the whole app. */
export function connectSocket() {
  const token = getToken();
  if (!token) return null;

  // Token changed start fresh
  if (socket && socket.auth?.token !== token) {
    socket.disconnect();
    socket = null;
  }

  if (!socket) {
    socket = io(SOCKET_URL, { auth: { token }, withCredentials: true });
  } else if (!socket.connected) {
    socket.connect();
  }

  return socket;
}

export function disconnectSocket() {
  if (socket) socket.disconnect();
  socket = null;
}

/* Listen to live order updates. Returns an unsubscribe function. */
export function subscribeOrderUpdates(handler) {
  const s = connectSocket();
  if (!s) return () => {};

  s.on("order:update", handler);
  return () => s.off("order:update", handler);
}

/* Tells the UI whether the live connection is up. Returns an unsubscribe function. */
export function onSocketState(callback) {
  const s = connectSocket();
  if (!s) {
    callback(false);
    return () => {};
  }

  const up = () => callback(true);
  const down = () => callback(false);

  callback(s.connected);
  s.on("connect", up);
  s.on("disconnect", down);
  s.on("connect_error", down);

  return () => {
    s.off("connect", up);
    s.off("disconnect", down);
    s.off("connect_error", down);
  };
}
