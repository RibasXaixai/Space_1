import { api } from "./api";
import type { ClothingItem, ClothingUpdatePayload } from "../types";

export function getClothingItems(token: string) {
  return api.get<ClothingItem[]>("/clothes/", {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

export function uploadClothing(formData: FormData, token: string) {
  return api.post<ClothingItem>("/clothes/upload", formData, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

export function updateClothing(id: number, data: ClothingUpdatePayload, token: string) {
  return api.put<ClothingItem>(`/clothes/${id}`, data, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

export function deleteClothing(id: number, token: string) {
  return api.delete(`/clothes/${id}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}
