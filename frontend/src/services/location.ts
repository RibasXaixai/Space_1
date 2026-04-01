import { api } from "./api";

export function getUserLocation(token: string) {
  return api.get<{ location: string | null }>("/user/location", {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

export function updateUserLocation(location: string, token: string) {
  return api.put<{ location: string }>(
    "/user/location",
    { location },
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );
}
