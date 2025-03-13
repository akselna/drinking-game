import { createContext } from "react";
import { CustomSocket } from "../types/socket.types";

// Create a context for the socket to be used throughout the app
export const SocketContext = createContext<CustomSocket | null>(null);
