import { createContext } from "react";
import { Socket } from "socket.io-client";

// Create a context for the socket to be used throughout the app
export const SocketContext = (createContext < Socket) | (null > null);
