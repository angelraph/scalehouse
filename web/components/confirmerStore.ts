"use client";

import { CHAIN_ID } from "@/lib/network";

/** The owner's copy of their confirmers' private links, kept in this browser only. */
export type LinkConfirmer = { name: string; address: string; link: string };

const key = (houseId: number) => `scalehouse:confirmers:${CHAIN_ID}:${houseId}`;

export function loadConfirmers(houseId: number): LinkConfirmer[] {
  try {
    return JSON.parse(localStorage.getItem(key(houseId)) ?? "[]") as LinkConfirmer[];
  } catch {
    return [];
  }
}

export function saveConfirmers(houseId: number, list: LinkConfirmer[]) {
  try {
    localStorage.setItem(key(houseId), JSON.stringify(list));
    window.dispatchEvent(new Event("scalehouse:confirmers"));
  } catch {
    // storage blocked: links can be fetched again with "Show my links"
  }
}

export const whatsapp = (text: string) => `https://wa.me/?text=${encodeURIComponent(text)}`;
