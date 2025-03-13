// 1. Først, lag en ny fil: src/types/socket.types.ts

import { Socket as OriginalSocket } from "socket.io-client";
import { DefaultEventsMap } from "socket.io/dist/typed-events";

// Utvidet Socket-type med dine egendefinerte egenskaper
export interface CustomSocket
  extends OriginalSocket<DefaultEventsMap, DefaultEventsMap> {
  hostId?: string;
  // Legg til andre egendefinerte egenskaper her om nødvendig
}

// 2. Erstatt innholdet i src/context/SocketContext.tsx (endre filendelsen fra .jsx til .tsx)

import React, { createContext } from "react";
import { CustomSocket } from "../types/socket.types";

// Lag en context med riktig type
export const SocketContext = createContext<CustomSocket | null>(null);

// 3. Oppdater src/components/ParticipantPanel.tsx

// Importer CustomSocket i stedet for Socket
import { CustomSocket } from "../types/socket.types";

// Endre propTypes
interface ParticipantPanelProps {
  players: any[];
  isHost: boolean;
  currentUserId: string;
  socket: CustomSocket | null;
  sessionId: string;
}

// Endre også hostPlayer-finneren for å håndtere hostId riktig
// Finn host-spilleren
const hostPlayer = players.find(
  (player) => player.isHost || (socket && player.id === socket.hostId)
);
