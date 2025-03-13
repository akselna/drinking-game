import { Socket } from "socket.io-client";

// Utvidet Socket-type med dine egendefinerte egenskaper
export interface CustomSocket extends Socket {
  hostId?: string;
  // Legg til andre egendefinerte egenskaper her om nødvendig
}
