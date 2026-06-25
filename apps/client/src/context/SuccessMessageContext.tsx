import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

type SuccessMessage = {
  id: number;
  message: string;
};

type SuccessMessageContextValue = {
  showSuccessMessage: (message: string) => void;
};

const SuccessMessageContext = createContext<SuccessMessageContextValue | null>(null);

export function SuccessMessageProvider({ children }: { children: ReactNode }) {
  const [messages, setMessages] = useState<SuccessMessage[]>([]);

  const dismissMessage = useCallback((id: number) => {
    setMessages((current) => current.filter((message) => message.id !== id));
  }, []);

  const showSuccessMessage = useCallback(
    (message: string) => {
      const id = Date.now() + Math.floor(Math.random() * 1000);
      setMessages((current) => [...current, { id, message }]);
      window.setTimeout(() => dismissMessage(id), 4200);
    },
    [dismissMessage]
  );

  const value = useMemo(() => ({ showSuccessMessage }), [showSuccessMessage]);

  return (
    <SuccessMessageContext.Provider value={value}>
      {children}
      {messages.length > 0 && (
        <div className="success-message-toast-container" aria-live="polite" aria-atomic="false">
          {messages.map((message) => (
            <article className="success-message-toast" key={message.id}>
              <div className="success-message-toast-content">
                <strong>Success</strong>
                <p>{message.message}</p>
              </div>
              <button
                type="button"
                className="success-message-toast-close"
                aria-label="Close success message"
                onClick={() => dismissMessage(message.id)}
              >
                x
              </button>
            </article>
          ))}
        </div>
      )}
    </SuccessMessageContext.Provider>
  );
}

export function useSuccessMessage() {
  const context = useContext(SuccessMessageContext);
  if (!context) {
    throw new Error("useSuccessMessage must be used within SuccessMessageProvider");
  }
  return context;
}
