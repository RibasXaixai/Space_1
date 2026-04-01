import { useEffect, useState } from "react";
import { getHealth } from "../services/api";

export function useHealth() {
  const [status, setStatus] = useState<string>("loading");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getHealth()
      .then(() => setStatus("online"))
      .catch(() => {
        setStatus("offline");
        setError("Unable to reach backend API.");
      });
  }, []);

  return { status, error };
}
