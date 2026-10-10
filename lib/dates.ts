import type { ISODate } from "./types";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const MS_PER_DAY = 86_400_000;

export function isISODate(value: unknown): value is ISODate {
  if (typeof value !== "string" || !ISO_DATE.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

/** Whole days since 1970-01-01 (UTC). Only ever compare dates through this. */
export function toDay(date: ISODate): number {
  const [y, m, d] = date.split("-").map(Number);
  return Date.UTC(y, m - 1, d) / MS_PER_DAY;
}

export function fromDay(day: number): ISODate {
  return new Date(day * MS_PER_DAY).toISOString().slice(0, 10);
}

export function addDays(date: ISODate, days: number): ISODate {
  return fromDay(toDay(date) + days);
}

/** b minus a, in calendar days. */
export function daysBetween(a: ISODate, b: ISODate): number {
  return toDay(b) - toDay(a);
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** '2026-10-17' -> '17 Oct'; with year: '17 Oct 2026'. */
export function formatDate(date: ISODate | null, withYear = false): string {
  if (!date) return "not set";
  const [y, m, d] = date.split("-").map(Number);
  return `${d} ${MONTHS[m - 1]}${withYear ? ` ${y}` : ""}`;
}

/** '17 Oct–20 Oct' style range, collapsing the month when shared: '17–20 Oct'. */
export function formatRange(start: ISODate, end: ISODate): string {
  const [, sm, sd] = start.split("-").map(Number);
  const [, em, ed] = end.split("-").map(Number);
  if (start === end) return formatDate(start);
  if (sm === em) return `${sd}–${ed} ${MONTHS[em - 1]}`;
  return `${formatDate(start)}–${formatDate(end)}`;
}
