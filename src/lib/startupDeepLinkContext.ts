import { createContext } from "react";

export const StartupDeepLinkContext = createContext({
  initialLinkResolved: false,
  startupRoutePending: false,
});
