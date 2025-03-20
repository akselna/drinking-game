import { Socket } from "socket.io-client";

// Extended Socket type with custom properties
export interface CustomSocket extends Socket {
  hostId?: string;
  // Add other custom properties here as needed
}
