import { createContext, useContext, useState } from "react";

const MobileNavContext = createContext(null);

export function MobileNavProvider({ children }) {
  const [isOpen, setIsOpen] = useState(false);
  const toggle = () => setIsOpen((v) => !v);
  const close = () => setIsOpen(false);

  return (
    <MobileNavContext.Provider value={{ isOpen, toggle, close }}>
      {children}
    </MobileNavContext.Provider>
  );
}

export const useMobileNav = () => useContext(MobileNavContext);
