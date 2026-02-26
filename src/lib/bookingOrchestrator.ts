/**
 * Client-side booking orchestration shim.
 * 
 * Intercepts AI reply responses to inject booking flow when the backend
 * doesn't yet support it natively. Remove this when backend orchestration is live.
 * 
 * Flow:
 * 1. After AI reply, check if all required fields are collected → offer booking
 * 2. Detect booking intent in user messages → route to booking flow
 * 3. Generate mock slots from scheduling settings working hours
 * 4. Track booking state per conversation in memory
 */

import { api } from "@/lib/apiClient";
import type { BookingPayload, BookingSlot } from "@/components/conversation/BookingPanel";

// ─── Booking intent detection (deterministic, no LLM) ───

const BOOKING_KEYWORDS = [
  /\b(book|booking|schedule|appointment)\b/i,
  /\b(call me|can we talk|meeting)\b/i,
  /\b(tomorrow|next week|this week|at \d{1,2}(:\d{2})?\s*(am|pm)?)\b/i,
  /\b(can i schedule|set up a (call|meeting|visit))\b/i,
  /\b(available\s*(time|slot)s?)\b/i,
  /\b(14:\d{2}|15:\d{2}|[0-9]{1,2}\s*(o'?clock|am|pm))\b/i,
];

export function detectBookingIntent(message: string): boolean {
  if (!message) return false;
  return BOOKING_KEYWORDS.some((rx) => rx.test(message));
}

// ─── Booking flow state (in-memory per conversation) ───

export type BookingStage =
  | "idle"
  | "awaiting_booking_confirmation"
  | "awaiting_name"
  | "awaiting_phone"
  | "awaiting_slot_choice"
  | "awaiting_custom_time"
  | "completed"
  | "declined";

export interface BookingFlowState {
  active: boolean;
  stage: BookingStage;
  requiredName: boolean;
  requiredPhone: boolean;
  nameCollected: boolean;
  phoneCollected: boolean;
  requestedType: string;
  selectedSlot: BookingSlot | null;
  proposedCustomTime: string | null;
  lastOfferedSlots: BookingSlot[];
  completed: boolean;
  offerShown: boolean;
}

const flowStates = new Map<string, BookingFlowState>();

export function getFlow(conversationKey: string): BookingFlowState {
  if (!flowStates.has(conversationKey)) {
    flowStates.set(conversationKey, {
      active: false,
      stage: "idle",
      requiredName: false,
      requiredPhone: false,
      nameCollected: false,
      phoneCollected: false,
      requestedType: "call",
      selectedSlot: null,
      proposedCustomTime: null,
      lastOfferedSlots: [],
      completed: false,
      offerShown: false,
    });
  }
  return flowStates.get(conversationKey)!;
}

function updateFlow(key: string, patch: Partial<BookingFlowState>) {
  const f = getFlow(key);
  Object.assign(f, patch);
}

/** Dismiss booking flow for a conversation */
export function dismissBookingFlow(conversationKey: string) {
  updateFlow(conversationKey, { active: false, stage: "declined", completed: false });
}

// ─── Normalized scheduling settings ───

export interface NormalizedSchedulingSettings {
  enabled: boolean;
  chatbotOfferBooking: boolean;
  askAfterQuote: boolean;
  requireName: boolean;
  requirePhone: boolean;
  bookingMode: string;
  defaultBookingType: string;
  showAvailableSlots: boolean;
  allowCustomTime: boolean;
  timezone: string;
  slotDurationMinutes: number;
  minimumNoticeHours: number;
  maxDaysAhead: number;
  workingHours: Array<{ day: string; enabled: boolean; ranges: Array<{ start: string; end: string }> }>;
}

function pick<T>(fallback: T, ...candidates: unknown[]): T {
  for (const c of candidates) if (c !== undefined && c !== null) return c as T;
  return fallback;
}

export function normalizeSchedulingSettings(raw: any): NormalizedSchedulingSettings {
  if (!raw) return { enabled: false, chatbotOfferBooking: false, askAfterQuote: false, requireName: false, requirePhone: false, bookingMode: "manual_request", defaultBookingType: "call", showAvailableSlots: false, allowCustomTime: false, timezone: "UTC", slotDurationMinutes: 30, minimumNoticeHours: 1, maxDaysAhead: 30, workingHours: [] };
  
  const cb = (raw?.chatbot_booking && typeof raw.chatbot_booking === "object") ? raw.chatbot_booking : {};

  return {
    enabled: Boolean(pick(false, raw.scheduling_enabled, raw.enabled)),
    chatbotOfferBooking: Boolean(pick(false, raw.chatbotOfferBooking, raw.chatbot_offers_booking, cb.chatbot_booking_enabled, cb.enabled, raw.chatbot_booking_enabled)),
    askAfterQuote: Boolean(pick(false, raw.chatbotCollectBookingAfterQuote, cb.ask_after_quote, raw.ask_after_quote)),
    requireName: Boolean(pick(false, raw.chatbotBookingRequiresName, cb.require_name, raw.require_name)),
    requirePhone: Boolean(pick(false, raw.chatbotBookingRequiresPhone, cb.require_phone, raw.require_phone)),
    bookingMode: String(pick("manual_request", cb.booking_mode, raw.booking_mode)),
    defaultBookingType: String(pick("call", cb.default_booking_type, raw.default_booking_type)),
    showAvailableSlots: Boolean(pick(false, raw.chatbotShowSlotsWhenAvailable, cb.show_available_slots, raw.show_available_slots)),
    allowCustomTime: Boolean(pick(false, raw.chatbotAllowUserProposedTime, cb.allow_custom_time, raw.allow_custom_time)),
    timezone: String(pick("UTC", raw.timezone)),
    slotDurationMinutes: Number(pick(30, raw.slot_duration_minutes, raw.slotDurationMinutes)),
    minimumNoticeHours: Number(pick(1, raw.minimum_notice_hours, raw.minimumNoticeHours)),
    maxDaysAhead: Number(pick(30, raw.max_days_ahead, raw.maxDaysAhead)),
    workingHours: normalizeWorkingHoursArray(raw.working_hours || raw.workingHours),
  };
}

function normalizeWorkingHoursArray(raw: unknown): Array<{ day: string; enabled: boolean; ranges: Array<{ start: string; end: string }> }> {
  if (Array.isArray(raw)) {
    return raw.map((item: any) => ({
      day: String(item?.day || "").toLowerCase(),
      enabled: Boolean(item?.enabled),
      ranges: Array.isArray(item?.ranges) ? item.ranges.map((r: any) => ({ start: r.start || "09:00", end: r.end || "17:00" })) : [],
    }));
  }
  if (raw && typeof raw === "object") {
    return Object.entries(raw as Record<string, any>).map(([day, val]) => ({
      day: day.toLowerCase(),
      enabled: Boolean(val?.enabled),
      ranges: Array.isArray(val?.ranges) ? val.ranges.map((r: any) => ({ start: r.start || "09:00", end: r.end || "17:00" })) : [],
    }));
  }
  return [];
}

// ─── Basic slot generation from working hours ───

export function generateSlotsFromWorkingHours(
  settings: NormalizedSchedulingSettings,
  count: number = 5
): BookingSlot[] {
  const slots: BookingSlot[] = [];
  const now = new Date();
  const minNotice = new Date(now.getTime() + settings.minimumNoticeHours * 60 * 60 * 1000);
  const maxDate = new Date(now.getTime() + settings.maxDaysAhead * 24 * 60 * 60 * 1000);
  const duration = settings.slotDurationMinutes || 30;
  const dayNames = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

  let cursor = new Date(minNotice);
  // Round up to next slot boundary
  cursor.setMinutes(Math.ceil(cursor.getMinutes() / duration) * duration, 0, 0);

  let iterations = 0;
  while (slots.length < count && cursor < maxDate && iterations < 500) {
    iterations++;
    const dayName = dayNames[cursor.getDay()];
    const dayConfig = settings.workingHours.find((d) => d.day === dayName);

    if (!dayConfig?.enabled) {
      // Skip to next day
      cursor.setDate(cursor.getDate() + 1);
      cursor.setHours(0, 0, 0, 0);
      continue;
    }

    const timeStr = `${String(cursor.getHours()).padStart(2, "0")}:${String(cursor.getMinutes()).padStart(2, "0")}`;
    const inRange = (dayConfig.ranges || []).some((r) => timeStr >= r.start && timeStr < r.end);

    if (inRange) {
      const end = new Date(cursor.getTime() + duration * 60 * 1000);
      const tz = settings.timezone || "UTC";
      const label = cursor.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" }) +
        " · " + cursor.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
      slots.push({
        id: `slot_${slots.length + 1}`,
        start: cursor.toISOString(),
        end: end.toISOString(),
        label,
        timezone: tz,
      });
    }

    cursor = new Date(cursor.getTime() + duration * 60 * 1000);

    // If past working hours for the day, jump to next day
    const endCheck = `${String(cursor.getHours()).padStart(2, "0")}:${String(cursor.getMinutes()).padStart(2, "0")}`;
    const stillInDay = (dayConfig.ranges || []).some((r) => endCheck < r.end);
    if (!stillInDay) {
      cursor.setDate(cursor.getDate() + 1);
      cursor.setHours(0, 0, 0, 0);
    }
  }

  return slots;
}

// ─── Booking offer message builder ───

function buildBookingOfferMessage(
  settings: NormalizedSchedulingSettings,
  slots: BookingSlot[]
): { text: string; booking: BookingPayload } {
  const type = settings.defaultBookingType || "call";
  const typeLabel = type.replace(/_/g, " ");

  if (settings.showAvailableSlots && slots.length > 0) {
    return {
      text: `I have some available times for a ${typeLabel}. Would you like to pick a slot?`,
      booking: {
        mode: "slots",
        slots,
        appointment_type: type,
        timezone: settings.timezone,
        quickActions: settings.allowCustomTime
          ? [{ label: "Propose another time", value: "I'd like to propose a time" }]
          : [],
      },
    };
  }

  return {
    text: `Would you like to schedule a ${typeLabel}?`,
    booking: {
      mode: "offer",
      appointment_type: type,
      timezone: settings.timezone,
      quickActions: [
        ...(settings.showAvailableSlots ? [{ label: "Show available slots", value: "Show available slots" }] : []),
        ...(settings.allowCustomTime ? [{ label: "Propose a time", value: "I'd like to propose a time" }] : []),
        { label: "Yes, book a call", value: "Yes, book a call" },
        { label: "Not now", value: "Not now" },
      ],
    },
  };
}

// ─── Main orchestration: process AI reply response ───

let cachedSettings: NormalizedSchedulingSettings | null = null;
let settingsFetchedAt = 0;
const SETTINGS_CACHE_MS = 60_000;

async function fetchSettings(): Promise<NormalizedSchedulingSettings> {
  if (cachedSettings && Date.now() - settingsFetchedAt < SETTINGS_CACHE_MS) {
    return cachedSettings;
  }
  try {
    const raw = await api.getSchedulingSettings();
    cachedSettings = normalizeSchedulingSettings(raw);
    settingsFetchedAt = Date.now();
  } catch {
    if (!cachedSettings) {
      cachedSettings = normalizeSchedulingSettings(null);
    }
  }
  return cachedSettings!;
}

/**
 * Check if we should inject booking flow into the AI reply.
 * Returns augmented response if booking should be triggered, or null if no change needed.
 */
export async function processAiReply(
  aiResponse: any,
  conversationKey: string,
  lastUserMessage?: string
): Promise<any | null> {
  // If backend already returned booking metadata, don't override
  const existingBooking = aiResponse?.booking || aiResponse?.meta?.booking || aiResponse?.ui_action?.booking;
  if (existingBooking && existingBooking.mode) {
    return null; // Backend handled it
  }

  const settings = await fetchSettings();

  // Check if scheduling is enabled and chatbot booking is on
  if (!settings.enabled || !settings.chatbotOfferBooking) {
    return null;
  }

  const flow = getFlow(conversationKey);

  // ── Handle active booking flow stages ──
  if (flow.active && lastUserMessage) {
    return handleActiveBookingFlow(flow, conversationKey, settings, lastUserMessage, aiResponse);
  }

  // ── Check for booking intent in user message (only if not already completed/dismissed) ──
  if (lastUserMessage && !flow.completed && flow.stage !== "declined" && detectBookingIntent(lastUserMessage)) {
    return startBookingFlow(conversationKey, settings, aiResponse);
  }

  // ── Check if all required fields collected (post-quote trigger) ──
  if (settings.askAfterQuote && !flow.offerShown && !flow.completed && flow.stage !== "declined") {
    const requiredInfos = aiResponse?.required_infos || aiResponse?.looking_for || [];
    const allCollected = Array.isArray(requiredInfos) && requiredInfos.length === 0;
    
    if (allCollected) {
      return startBookingFlow(conversationKey, settings, aiResponse);
    }
  }

  return null;
}

async function startBookingFlow(
  conversationKey: string,
  settings: NormalizedSchedulingSettings,
  aiResponse: any
): Promise<any> {
  const flow = getFlow(conversationKey);

  // Check prereqs
  if (settings.requireName && !flow.nameCollected) {
    updateFlow(conversationKey, { active: true, stage: "awaiting_name", offerShown: true, requiredName: true, requestedType: settings.defaultBookingType });
    return {
      ...aiResponse,
      assistant_message: (aiResponse?.assistant_message || "") + "\n\nBefore we schedule, could you share your name?",
      booking: { mode: "awaiting_name" as const, appointment_type: settings.defaultBookingType, timezone: settings.timezone },
    };
  }

  if (settings.requirePhone && !flow.phoneCollected) {
    updateFlow(conversationKey, { active: true, stage: "awaiting_phone", offerShown: true, requiredPhone: true, requestedType: settings.defaultBookingType });
    return {
      ...aiResponse,
      assistant_message: (aiResponse?.assistant_message || "") + "\n\nCould you share your phone number so we can reach you?",
      booking: { mode: "awaiting_phone" as const, appointment_type: settings.defaultBookingType, timezone: settings.timezone },
    };
  }

  // Generate slots if configured
  let slots: BookingSlot[] = [];
  if (settings.showAvailableSlots) {
    try {
      // Try real endpoint first
      const res = await api.getAvailableSlots({
        type: settings.defaultBookingType,
        from: new Date().toISOString().split("T")[0],
        to: new Date(Date.now() + settings.maxDaysAhead * 86400000).toISOString().split("T")[0],
      });
      const rawSlots = Array.isArray(res) ? res : Array.isArray(res?.slots) ? res.slots : Array.isArray(res?.data) ? res.data : [];
      slots = rawSlots.slice(0, 5);
    } catch {
      // Fallback: generate from working hours
      slots = generateSlotsFromWorkingHours(settings, 5);
    }
  }

  const offer = buildBookingOfferMessage(settings, slots);

  updateFlow(conversationKey, {
    active: true,
    stage: slots.length > 0 ? "awaiting_slot_choice" : "awaiting_booking_confirmation",
    offerShown: true,
    lastOfferedSlots: slots,
    requestedType: settings.defaultBookingType,
  });

  const existingMsg = aiResponse?.assistant_message || "";
  return {
    ...aiResponse,
    assistant_message: existingMsg ? `${existingMsg}\n\n${offer.text}` : offer.text,
    booking: offer.booking,
  };
}

function handleActiveBookingFlow(
  flow: BookingFlowState,
  conversationKey: string,
  settings: NormalizedSchedulingSettings,
  userMessage: string,
  aiResponse: any
): any | null {
  const msg = userMessage.toLowerCase().trim();

  // Declined
  if (/\b(not now|no thanks|later|maybe later|decline|skip)\b/i.test(msg)) {
    updateFlow(conversationKey, { active: false, stage: "declined", completed: false });
    return {
      ...aiResponse,
      booking: { mode: "declined" as const },
    };
  }

  // Awaiting name
  if (flow.stage === "awaiting_name") {
    // Accept any non-trivial string as name
    if (msg.length >= 2) {
      updateFlow(conversationKey, { nameCollected: true, stage: settings.requirePhone && !flow.phoneCollected ? "awaiting_phone" : "awaiting_slot_choice" });
      if (settings.requirePhone && !flow.phoneCollected) {
        return {
          ...aiResponse,
          assistant_message: (aiResponse?.assistant_message || "") + "\n\nThanks! Could you also share your phone number?",
          booking: { mode: "awaiting_phone" as const, appointment_type: flow.requestedType, timezone: settings.timezone },
        };
      }
      // Prereqs done, show slots
      return startBookingFlow(conversationKey, settings, aiResponse);
    }
  }

  // Awaiting phone
  if (flow.stage === "awaiting_phone") {
    if (/[\d+\-()]{6,}/.test(msg)) {
      updateFlow(conversationKey, { phoneCollected: true, stage: "awaiting_slot_choice" });
      return startBookingFlow(conversationKey, settings, aiResponse);
    }
  }

  // User wants to see slots
  if (/\b(show.*slot|available.*time|show.*available)\b/i.test(msg)) {
    let slots: BookingSlot[] = [];
    slots = generateSlotsFromWorkingHours(settings, 5);
    updateFlow(conversationKey, { stage: "awaiting_slot_choice", lastOfferedSlots: slots });
    return {
      ...aiResponse,
      assistant_message: slots.length > 0 ? "Here are some available times:" : "I couldn't find available slots right now.",
      booking: {
        mode: "slots" as const,
        slots,
        appointment_type: flow.requestedType,
        timezone: settings.timezone,
      },
    };
  }

  // User wants to propose custom time
  if (/\b(propose|custom|my own|prefer|another time)\b/i.test(msg)) {
    updateFlow(conversationKey, { stage: "awaiting_custom_time" });
    return {
      ...aiResponse,
      assistant_message: (aiResponse?.assistant_message || "") || "When would work best for you?",
      booking: {
        mode: "awaiting_custom_time" as const,
        appointment_type: flow.requestedType,
        timezone: settings.timezone,
      },
    };
  }

  // User accepted booking / wants to book
  if (/\b(yes|confirm|book|sure|go ahead|sounds good|let's do it)\b/i.test(msg) && flow.stage === "awaiting_booking_confirmation") {
    // Try to show slots
    const slots = generateSlotsFromWorkingHours(settings, 5);
    if (slots.length > 0) {
      updateFlow(conversationKey, { stage: "awaiting_slot_choice", lastOfferedSlots: slots });
      return {
        ...aiResponse,
        assistant_message: "Here are some available times:",
        booking: {
          mode: "slots" as const,
          slots,
          appointment_type: flow.requestedType,
          timezone: settings.timezone,
        },
      };
    }
    // No slots, ask for preferred time
    updateFlow(conversationKey, { stage: "awaiting_custom_time" });
    return {
      ...aiResponse,
      assistant_message: "When would work best for you?",
      booking: { mode: "awaiting_custom_time" as const, appointment_type: flow.requestedType, timezone: settings.timezone },
    };
  }

  // Awaiting custom time - capture the time preference
  if (flow.stage === "awaiting_custom_time" && msg.length >= 3) {
    updateFlow(conversationKey, { proposedCustomTime: userMessage, stage: "completed", completed: true, active: false });
    return {
      ...aiResponse,
      assistant_message: (aiResponse?.assistant_message || "") + `\n\nGot it — I've noted your preference for "${userMessage}". Our team will confirm the exact time shortly.`,
      booking: {
        mode: "confirmed" as const,
        appointment_type: flow.requestedType,
        timezone: settings.timezone,
        appointment: {
          type: flow.requestedType,
          status: "pending_confirmation",
        },
        summary: {
          type: flow.requestedType,
          date: userMessage,
          timezone: settings.timezone,
        },
      },
    };
  }

  // Nothing matched in active flow, let normal AI reply through
  return null;
}

/** Reset booking state for a conversation (e.g. on new session) */
export function resetBookingFlow(conversationKey: string) {
  flowStates.delete(conversationKey);
}
